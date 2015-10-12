'use strict'

var EventEmitter = require('events'),
    util = require('util'),
    uuid = require('uuid')

module.exports = 
{
    Channel: Channel,
    ChannelEnd: ChannelEnd
}

function Channel (id)
{
    this.id = id || uuid.v4()
    
    var left = new EventEmitter(),
        right = new EventEmitter
    
    this.on = left.on.bind(left)
    
    var right_emit = right.emit
    this.emit = function ()
    {
        var star_args = Array.prototype.slice.apply(arguments)
        star_args.unshift('*')
        right_emit.apply(right, star_args)
        right_emit.apply(right, arguments)
    }
    
    this.end = new ChannelEnd(this.id, right, left)
}

function ChannelEnd (id, left, right)
{
    this.id = id || uuid.v4()
    this.references = 1
    this.on = left.on.bind(left)
    this.emit = right.emit.bind(right)
}

ChannelEnd.prototype.increment = function ()
{
    this.references++
}

ChannelEnd.prototype.decrement = function ()
{
    this.references--
    
    if (this.references == 0)
    {
        this.emit('close')
    }
}

ChannelEnd.prototype.close = ChannelEnd.prototype.decrement