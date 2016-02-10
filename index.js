'use strict';

module.exports = function(SPlugin) {

    const AWS      = require('aws-sdk'),
        path       = require('path'),
        fs         = require('fs'),
        BbPromise  = require('bluebird'); // Serverless uses Bluebird Promises and we recommend you do to because they provide more than your average Promise :)

    class ServerlessPluginCronJob extends SPlugin {
        constructor(S) {
            super(S);
        }

        static getName() {
            return 'com.serverless.' + ServerlessPluginCronJob.name;
        }

        registerHooks() {

            this.S.addHook(this._addCronjobAfterDeploy.bind(this), {
                action: 'functionDeploy',
                event:  'post'
            });
            this.S.addHook(this._addCronjobAfterDeploy.bind(this), {
                action: 'dashDeploy',
                event:  'post'
            });

            return BbPromise.resolve();
        }

        /**
         * adds cronjob-task after the deployment of a function
         *
         * @param object evt
         *
         * @return promise
         */
        _addCronjobAfterDeploy(evt) {
            let _this = this;

            return new BbPromise(function(resolve, reject) {
                for(var region in evt.data.deployed) {
                    _this._manageCronJob(evt, region);
                }

                return resolve(evt);
            });
        }

        /**
         * Handles the Creation of a cronjobtask
         *
         * @param object evt Event
         * @param string region
         *
         * @return promise
         */
        _manageCronJob (evt, region) {
            let _this = this;

            _this.stage = evt.options.stage;
            _this._initAws(region);

            if (_this.S.cli.action != 'deploy' || (_this.S.cli.context != 'function' && _this.S.cli.context != 'dash'))
                return;

            _this.cronJobSettings = _this._getFunctionsCronJobSettings(evt, region);

            // no cron.json found
            if (_this.cronJobSettings.length == 0) {
                return;
            }

            for (var i in _this.cronJobSettings) {  
                var params = {
                    "Name": _this.cronJobSettings[i].cronjob.name,
                    "Description": _this.cronJobSettings[i].cronjob.description,
                    "ScheduleExpression": _this.cronJobSettings[i].cronjob.schedule,
                    "State": (_this.cronJobSettings[i].cronjob.enabled == true ? "ENABLED" : "DISABLED")
                };

                _this.cloudWatchEvents.putRuleAsync(params)
                .then(function(result){
                    return _this.lambda.addPermissionAsync({
                        FunctionName: _this._getFunctionArn(_this.cronJobSettings[i]),
                        StatementId: Date.now().toString(),
                        Action: 'lambda:InvokeFunction',
                        Principal: 'events.amazonaws.com',
                        Qualifier: _this.stage
                    })
                    .then(function(){
                        console.log('permissions added');
                    })
                    .catch(function(e) {
                        console.log('error during adding permission to Lambda');
                        console.log(e);
                    });
                })
                .then(function(result){
                    var _this = this;

                    return _this.cloudWatchEvents.putTargetsAsync({
                        Rule: _this.cronJobSettings[i].cronjob.name,
                        Targets: [
                            {
                                Arn: _this.cronJobSettings[i].deployed.Arn,
                                Id: _this._getTargetId(_this.cronJobSettings[i])
                            }
                        ]
                    })
                    .then(function(){
                        console.log('cronjob created');
                    })
                    .catch(function(e) {
                        console.log('error during creation of cronjob targets');
                        console.log(e);
                    });
                }.bind(_this))
               .catch(function(e) {
                    console.log('error during creation of cronjob rules');
                    console.log(e);
                });
            }
        }

        /**
         * returns the arn of the function, automatically selects the latest version, as stage-names are not useable ;(
         *
         * @param object settings
         *
         * @return string
         */
        _getFunctionArn (settings) {
            var _this = this;
            return settings.deployed.Arn.replace(':' + _this.stage, '');
        }

        /**
         * creates a target id, this is absolutely undocumented in aws cli... "The unique target assignment ID."
         * here a hash key is created with the cronjob name and the function name - should be unique enough
         *
         * @param object settings
         *
         * @return string
         */
        _getTargetId (settings) {
            var _this = this;

            var targetId = settings.deployed.Arn + "---" + settings.cronjob.name;
            targetId = targetId.replace(/:/g, '_');
            targetId = "ID" + _this._hashed(targetId);

            return targetId;
        }

        /**
         * creates a small hash for a string
         *
         * @param string s
         *
         * @return integer
         */
        _hashed (s) {
            return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);              
        }

        /**
         * initializes aws
         *
         * @param string region
         *
         * @return void
         */
        _initAws (region) {
            let _this = this;

            _this.cloudWatchEvents = new AWS.CloudWatchEvents({
                region: region,
                accessKeyId: this.S.config.awsAdminKeyId,
                secretAccessKey: this.S.config.awsAdminSecretKey
            });

            _this.lambda = new AWS.Lambda({
                region: region,
                accessKeyId: this.S.config.awsAdminKeyId,
                secretAccessKey: this.S.config.awsAdminSecretKey
            });

            BbPromise.promisifyAll(_this.cloudWatchEvents);
            _this.lambda.addPermissionAsync = BbPromise.promisify(_this.lambda.addPermission);
        }


        /**
         * parses the s-function.json file and returns the data
         *
         * @param object evt
         * @param string region
         *
         * @return array
         */
        _getFunctionsCronJobSettings(evt, region){
            let _this = this;
            var settings = [];
            for (var deployedIndex in evt.data.deployed[region]) {
                let deployed = evt.data.deployed[region][deployedIndex],
                    settingsFile = _this.S.config.projectPath + '/' + deployed.component + '/' + deployed.module + '/' + deployed.function + '/s-function.json';

                if (!fs.existsSync(settingsFile)) {
                    continue;
                }

                var config = JSON.parse(fs.readFileSync(settingsFile));

                if (!config.cronjob) {
                    continue;
                }

                settings.push({
                    "deployed": deployed,
                    "cronjob": config.cronjob
                });
            }

            return settings;
        }
    }

    return ServerlessPluginCronJob;
};
