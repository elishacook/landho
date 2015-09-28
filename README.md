# Land Ho!!

A data service library for node.

`<disclaimer>This is a new project and is changing rapidly.</disclaimer>`


* [Install](#install)
* [Quick Start](#quick-start)
* [Extensions](#extensions)
* [Guide](#guide)
* [API Docs](#api-docs)

## What you get

* One API for creating services with both request/response and realtime feed models
* Socket.IO integration
* [TODO] Express integration
* Hooks so you can validate, authorize or do whatever
* Frequent, wistful imaginings involving crow's nests and shouting

## Install

```bash
npm install --save landho
```

## Quick start

You create an API object and add services to it.

```js

// Create a landho instance.
var api = require('landho')()

// Define a service
api.service('calculator',
{
    add: function (params, done)
    {
        done(null, params.a + params.b)
    },
    
    subtract: function (params, done)
    {
        done(null, params.a - params.b)
    }
})

// Fetch the service and call one of its methods
api.service('calculator').add(
    { a: 5, b: 72 },
    function (err, result)
    {
        console.log(result) // 77
    }
)
```

As you can see, services are basically collections of methods written standard node continuation style. This is how you create services with request/response model. There's lots more you can do.

## Extensions

There will be an extension for quickly creating services backed by rethinkdb.

## Guide

In the [quick start](#quick-start) we saw how to create simple service with a request/response model. Let's learn some more.

### Creating realtime feeds

To create a service that provides a realtime feed, write your method to return a feed object.

```js

// Fetch the service and extend 
// it with a new method.
api.service('counter',
{
    // Notice that we ignore the `done` callback. 
    // It doesn't get used when we return a feed object.
    create: function (params)
    {
        return {
            // The feed takes a subscriber object and calls its
            // methods when changes occur.
            feed: function (subscriber, done)
            {
                var counter = 0
                var interval = setInterval(function ()
                {
                    counter += 1
                    
                    // Updating the subscriber each time the count
                    // is incremented
                    subscriber.update(counter)
                }, 1000)
                
                // Call the callback with an object that has a `close()`
                // method that will ensure the subscriber is no longer updated.
                done(null, { 
                    close: function () {
                        clearInterval(interval)
                    }
                })
            }
        }
    }
})

// We can subscribe to the feed by passing a subscriber 
// object in the the params.
api.service('counter').create(
    {
        subscriber: {
            // Gets called on each increment
            update: function (n)
            {
                console.log(n) // 0...1...2...3...4...
            }
        }
    },
    function (err, feed)
    {
        // And when we are done, we'll want to close the feed
        feed.close()
    }
)
```

### Supporting both feeds and request/response

Services can support both request/response and feed models by returning an object that has both a `feed` and a `value` entry.

```js
var list = [],
    subscribers = []

api.service('list').extend(
{
    push: function (params, done)
    {
        list.push(params.value)
        subscribers.forEach(function (s)
        {
            s.insert(value)
        })
        done()
    },
    
    get: function (params)
    {
        return {
            value: function (done)
            {
                done(null, list)
            },
            feed: function (subscriber, done)
            {
                subscriber.initialize(list)
                subscribers.push(subscriber)
                
                return {
                    close: function ()
                    {
                        subscribers.splice(subscribers.indexOf(subscriber), 1)
                    }
                }
            }
        }
    }
})

// Now we can use the service like this

api.service('list')
        .push({ value: 'foo' })
        .get({}, function (err, result)
        {
            console.log(result) // ['foo']
        })

// Or like this

api.service('list')
        .get(
            {
                subscriber: {
                    initialize: function (value)
                    {
                        console.log(value) // ['foo']
                    },
                    insert: function (value)
                    {
                        console.log(value) // 'bar'...'baz'
                    }
                }
            }
        )
        .push({ value: 'bar' })
        .push({ value: 'baz' })

```

### Hooks

Hooks can be registered on a service method either before or after the method is called. Here is an example of using a `before` hook for validation.

```js
api.service('list').before(
{
    push: function (params, next)
    {
        if (params.value == undefined)
        {
            next(new Error('A value parameter must be provided'))
        }
        else
        {
            next()
        }
    }
})
```

// Now we have to provide a value when calling `list.push()` or it won't be run

api.service('list').push({}, function (err, result)
{
    console.log(err) // 'A value parameter must be provided'
})
```

Hooks are run in the order they are registered. If any hook fails by calling `next` with an error, processing stops and the method callback is called with the error object. If the caller provided a subscriber object, it has its `error()` method called.

`after` hooks are like `before` hooks but they run after the method successfully returns a result. They have access to the result of the method call in `params.result` and can transform it like so:

```js
api.service('list').after(
{
    get: function (params, next)
    {
        params.result = { list: params.result, other_thing: 123 }
        next()
    }
})

// Now when we call get(), we will get the transformed result
api.service('list').get({}, function (err, result)
{
    console.log(result) // { list: ['foo', 'bar', 'baz'], other_thing: 123 }
})
```

It's important to note that `after` hooks are never called when subscribing to a feed.

# API Docs

[TODO]