'use strict'

var Application = require('./application')

var landho = function ()
{
    return new Application()
}

landho.socket = require('./socket')
landho.Channel = require('./channel').Channel

module.exports = landho