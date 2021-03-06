'use strict'

var Service = require('../lib/Service'),
    channel = require('../lib/channel'),
    Channel = channel.Channel,
    ChannelEnd = channel.ChannelEnd

describe('Service', function ()
{
    it('can be created with a name and methods', function ()
    {
        var foo = new Service('foo', { stuff: function (params, done) { done(null, 123) } })
        expect(foo.name).to.equal('foo')
        expect(foo.stuff).to.not.be.undefined
        foo.stuff({}, function (err, result)
        {
            expect(err).to.be.null
            expect(result).to.equal(123)
        })
    })
    
    it('can be extended with new methods', function ()
    {
        var foo = new Service('foo')
        foo
            .extend(
            {
                bar: function (params, done) { done(null, 'bar') },
                baz: function (params, done) { done(null, 'baz') }
            })
            .extend(
            {
                qux: function (params, done) { done(null, 'qux') }
            })
        
        foo.bar({}, function (err, result)
        {
            expect(err).to.be.null
            expect(result).to.equal('bar')
        })
        
        foo.baz({}, function (err, result)
        {
            expect(err).to.be.null
            expect(result).to.equal('baz')
        })
        
        foo.qux({}, function (err, result)
        {
            expect(err).to.be.null
            expect(result).to.equal('qux')
        })
    })
    
    it('can have before hooks', function ()
    {
        var foo = new Service(
            'foo',
            {
                stuff: function (params, done)
                {
                    done(null, params.value * params.value)
                }
            }
        ).before({
            stuff: function (params, next)
            {
                params.value = 2
                next()
            }
        })
        
        foo.stuff({}, function (err, result)
        {
            expect(result).to.equal(4)
        })
    })
    
    it('throws an error if attempting to register a before hook on an unregistered method', function ()
    {
        var foo = new Service()
        expect(function ()
        {
            foo.before({ things: function () {} })
        }).to.throw('Attempting to hook unregistered method "things"')
    })
    
    it('can have after hooks', function ()
    {
        var foo = new Service(
            'foo',
            {
                stuff: function (params, done)
                {
                    done(null, 5)
                }
            }
        ).after({
            stuff: function (params, next)
            {
                params.result = params.result * params.result
                next()
            }
        })
        
        foo.stuff({}, function (err, result)
        {
            expect(result).to.equal(25)
        })
    })
    
    it('throws an error if attempting to register an after hook on an unregistered method', function ()
    {
        var foo = new Service()
        expect(function ()
        {
            foo.after({ things: function () {} })
        }).to.throw('Attempting to hook unregistered method "things"')
    })
    
    it('can register multiple hooks for a method using an array', function (done)
    {
        var foo = new Service('foo',
        {
            stuff: function (params, done)
            {
                params.list.push('third')
                done(null, params.list)
            }
        })
        
        foo
            .before(
            {
                stuff: [
                    function (params, next) { params.list.push('first'); next() },
                    function (params, next) { params.list.push('second'); next() }
                ]
            })
            .after(
            {
                stuff: [
                    function (params, next) { params.list.push('fourth'); next() },
                    function (params, next) { params.list.push('fifth'); next() }
                ]
            })
        
        foo.stuff({ list: [] }, function (err, result)
        {
            expect(err).to.be.null
            expect(result).to.deep.equal(['first', 'second', 'third', 'fourth', 'fifth'])
            done()
        })
    })

    it('returns a ChannelEnd if a service method returns a Channel', function (done)
    {
        var channel = new Channel(),
            foo = new Service('foo',
            {
                stuff: function (params, done)
                {
                    done(null, channel)
                }
            })
        
        foo.stuff({}, function (err, result)
        {
            expect(result).to.be.instanceof(ChannelEnd)
            
            result.on('fnord', function (arg)
            {
                expect(arg).to.equal(123)
                done()
            })
            
            channel.emit('fnord', 123)
        })
    })
    
    it('returns a promise if no callback is passed to a service method', function ()
    {
        var foo = new Service('foo',
        {
            stuff: function (params, done)
            {
                done(null, params.a + params.b)
            }
        })
        
        return foo.stuff({a:1, b:10}).then(function (result)
        {
            expect(result).to.equal(11)
        })
    })
    
    it('returns a rejected promise if no callback is passed to a service method and there is an error', function ()
    {
        var foo = new Service('foo',
        {
            stuff: function (params, done)
            {
                done('bad times')
            }
        })
        
        return foo.stuff({a:1, b:10}).catch(function (err)
        {
            expect(err).to.equal('bad times')
        })
    })
    
    it('promises work with before hooks', function ()
    {
        var foo = new Service('foo',
        {
            stuff: function (params, done)
            {
                done(null, params.a * params.b)
            }
        })
        .before({
            stuff: function (params, done)
            {
                params.b = 100
                done()
            }
        })
        
        return foo.stuff({a:2, b:10}).then(function (result)
        {
            expect(result).to.equal(200)
        })
    })
    
    it('promises work with after hooks', function ()
    {
        var foo = new Service('foo',
        {
            stuff: function (params, done)
            {
                done(null, params.a * params.b)
            }
        })
        .after({
            stuff: function (params, done)
            {
                params.result = 'skidoo'
                done()
            }
        })
        
        return foo.stuff({ a: 2, b: 10 }).then(function (result)
        {
            expect(result).to.equal('skidoo')
        })
    })
    
    it('can have a service that returns a null result', function ()
    {
        var foo = new Service('foo',
        {
            stuff: function (params, done)
            {
                done()
            }
        })
        
        return foo.stuff()
    })
    
    it('can have a service method that returns a promise', function (done)
    {
        var foo = new Service('foo',
        {
            stuff: function (params)
            {
                return new Promise(function (resolve)
                {
                    resolve('skidoo')
                })
            }
        })
        
        foo.stuff(null, function (err, res)
        {
            expect(res).to.equal('skidoo')
            done()
        })
    })
    
    it('can have a service method that returns a promise and uses promise calling', function ()
    {
        var foo = new Service('foo',
        {
            stuff: function (params)
            {
                return new Promise(function (resolve)
                {
                    resolve('skidoo')
                })
            }
        })
        
        return foo.stuff().then(function (result)
        {
            expect(result).to.equal('skidoo')
        })
    })
})