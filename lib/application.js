'use strict'

var Service = require('./service')


var Application = function (io)
{
    this.io = io
    this.services = {}
}

Application.prototype.service = function ()
{
    if (arguments.length == 1)
    {
        var service = this.services[arguments[0]]
        if (service)
        {
            return service
        }
        else
        {
            throw new Error('No service registered with the name "'+arguments[0]+'"')
        }
    }
    else if (arguments.length == 2)
    {
        var name = arguments[0],
            options = arguments[1]
            
        if (this.services[name])
        {
            throw new Error('There is already a service registered with the name "'+name+'"')
        }
        else
        {
            var service = new Service(name, options)
            this.services[name] = service
            return service
        }
    }
    else
    {
        throw new Error('I have no idea what to do with these arguments: '+JSON.stringify(arguments))
    }
}

module.exports = Application