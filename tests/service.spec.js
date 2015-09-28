'use strict'

var Service = require('../lib/Service')

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
    
    it('returns the value from a method result that has a feed if the caller does not provide a subscriber', function (done)
    {
        var foo = new Service('foo',
        {
            stuff: function (params)
            {
                return {
                    initial: function (done)
                    {
                        done(null, 123)
                    },
                    changes: function (subscriber, done)
                    {
                        done(null, { close: function () {} })
                    }
                }
            }
        })
        foo.stuff({}, function (err, result)
        {
            expect(result).to.equal(123)
            done()
        })
    })
    
    it('emits the initial event on a subscriber when a subscriber is provided for a method without a feed', function (done)
    {
        var foo = new Service('foo',
        {
            stuff: function (params, done)
            {
                done(null, 123)
            }
        })
        
        foo.stuff(
            {
                subscriber: {
                    emit: function (event, value)
                    {
                        expect(event).to.equal('initial')
                        expect(value).to.equal(123)
                        done()
                    }
                }
            },
            function ()
            {
                
            }
        )
    })
    
    it('passes the feed as the result argument to the callback when a subscriber is provided to a feed method', function (done)
    {
        var foo = new Service('foo',
        {
            stuff: function (params, done)
            {
                return {
                    initial: function (done)
                    {
                        done(null, 123)
                    },
                    changes: function (subscriber, done)
                    {
                        done(null, { close: function () {} })
                    }
                }
            }
        })
        
        foo.stuff(
            { subscriber: { emit: function (event, value) {} } },
            function (err, feed)
            {
                expect(err).to.be.null
                expect(feed).to.not.be.undefined
                expect(feed.close).to.not.be.undefined
                done()
            }
        )
    })
    
    it('has a null result when calling a non-feed method with a subscriber', function (done)
    {
        var foo = new Service('foo',
        {
            stuff: function (params, done)
            {
                done(null, 123)
            }
        })
        
        foo.stuff(
            { subscriber: { emit: function (event, value) {} } },
            function (err, feed)
            {
                expect(err).to.be.null
                expect(feed).to.be.null
                done()
            }
        )
    })
    
})