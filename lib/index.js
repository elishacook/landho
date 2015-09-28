'use strict'

var Application = require('./application')

var landho = function ()
{
    return new Application()
}

landho.socket = require('./socket')

module.exports = landho