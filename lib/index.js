'use strict'

var Application = require('./application')

module.exports = function (io)
{
    return new Application(io)
}