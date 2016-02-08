Serverless Plugin CRONJOB
=========================

This plugin creates cronjobs out of your lambda functions.

*Note*: This plugin supports Serverless 0.2.* and 0.3.*


### Installation

 - make sure that aws and serverless are installed
 - @see http://docs.aws.amazon.com/cli/latest/userguide/installing.html
 - @see http://www.serverless.com/

 - install this plugin to your projects node_modules folder

```
cd projectfolder
npm install serverless-plugin-cronjob
```

 - add the plugin to your s-project.json file

```
"plugins": [
    "serverless-plugin-cronjob"
]
```

### Run the Plugin

 - the plugin uses a hook that is called after each deployment of a function 
 - you only have to deploy your function as usual `sls function deploy`
 - add the following attribute to the s-function.json in your functions folder

```
  ...
  "cronjob": {
    "name": "cron1",
    "description": "my fancy cronjob",    
    "enabled": false,
    "schedule": "rate(5 minutes)"
  },
  ...
```

 - Parameters:
   - name: (string) Name of your cronjob
   - description: (string) Describtion for your cronjob
   - schedule: (string) defines when the cronjob should run. two different types are useable:
     a) rate(x time), where "x" is an integer number and time is any value of minutes, hours or days
     b) cron(0 20 * * ? *), where the default crontab rules can be used
   - enabled: (boolean) true or false, to enable or disable this cron
 
 - please check the docs for detailed descriptions 
 - https://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/ScheduledEvents.html

