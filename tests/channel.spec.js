'use strict'

var channel = require('../lib/channel'),
    Channel = channel.Channel,
    ChannelEnd = channel.ChannelEnd
    
describe('Channel', function ()
{
    it('has an auto-generated ID by default', function ()
    {
        var chann = new Channel()
        expect(chann.id).to.not.be.undefined
        expect(chann.id).to.not.be.null
        
        var chann2 = new Channel()
        expect(chann2.id).to.not.equal(chann.id)
    })
    
    it('can use an id passed in during construction', function ()
    {
        var chann = new Channel(123)
        expect(chann.id).to.equal(123)
    })
    
    it('has emit() and on() methods', function ()
    {
        var chann = new Channel()
        expect(chann.on).to.be.instanceof(Function)
        expect(chann.emit).to.be.instanceof(Function)
    })
    
    it('has another end', function ()
    {
        var chann = new Channel(),
            end = chann.end
            
        expect(end).to.be.instanceof(ChannelEnd)
    })
    
    it('is connected to its other end', function (done)
    {
        var chann = new Channel(),
            end = chann.end
            
        end.on('foo', function (x)
        {
            expect(x).to.equal(1)
        })
        
        chann.on('foo', function (x)
        {
            expect(x).to.equal(2)
            done()
        })
        
        chann.emit('foo', 1)
        end.emit('foo', 2)
    })
})

describe('ChannelEnd', function ()
{
    it('has a reference count', function ()
    {
        var chann = new Channel()
        expect(chann.end.references).to.equal(1)
    })
    
    it('can increment its refcount', function ()
    {
        var chann = new Channel()
        chann.end.increment()
        expect(chann.end.references).to.equal(2)
    })
    
    it('can decrement its refcount', function ()
    {
        var chann = new Channel()
        chann.end.decrement()
        expect(chann.end.references).to.equal(0)
    })
    
    it('emits close when the refcount hits zero', function ()
    {
        var chann = new Channel(),
            close = sinon.stub()
        chann.on('close', close)
        chann.end.increment()
        chann.end.decrement()
        chann.end.decrement()
        expect(close).to.have.been.calledOnce
    })
})