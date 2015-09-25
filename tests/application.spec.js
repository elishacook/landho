'use strict'

var Application = require('../lib/application'),
    Service = require('../lib/service')


describe('Application', function ()
{
    it('can be initialized with an io', function ()
    {
        var app = new Application('io')
        expect(app.io).to.equal('io')
    })
    
    it('has a service method', function ()
    {
        var app = new Application()
        expect(app.service).to.not.be.undefined
    })
    
    it('can create a service by passing a name and options', function ()
    {
        var app = new Application(),
            foo = app.service('foo', { option: 123 })
        
        expect(foo.constructor).to.equal(Service)
        expect(foo.options).to.deep.equal({ option: 123 })
    })
    
    it('can retrieve a service by name', function ()
    {
        var app = new Application(),
            foo = app.service('foo', { option: 123 }),
            foo2 = app.service('foo')
        
        expect(foo2).to.equal(foo)
    })
    
    it('throws an error when trying to fetch an unregistered service', function ()
    {
        var app = new Application()
        expect(app.service.bind(app, 'foo')).to.throw('No service registered with the name "foo"')
    })
    
    it('throws an error when trying to register a service that was already registered', function ()
    {
        var app = new Application(),
            foo = app.service('bar', { option: 123 })
            
        expect(function ()
        {
            app.service('bar', { option: 666 })
        }).to.throw('There is already a service registered with the name "bar"')
    })
    
    it('throws an error when calling service() without 1 or 2 arguments', function ()
    {
        var app = new Application()
        expect(function ()
        {
            app.service(1, 2, 3)
        }).to.throw('I have no idea what to do with these arguments: {"0":1,"1":2,"2":3}')
    })
})