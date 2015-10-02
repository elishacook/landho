'use strict'

module.exports = run_hooks

function run_hooks (hooks, args, done)
{
    if (!hooks || hooks.length == 0)
    {
        done()
    }
    else
    {
        run_next_hook(hooks, 0, args, done)
    }
}

function run_next_hook (hooks, i, args, done)
{
    if (i >= hooks.length)
    {
        done()
        return
    }
    
    var hook = hooks[i],
        hook_args = args.slice()
        
    hook_args.push(function (err)
    {
        if (err)
        {
            done(err)
        }
        else
        {
            run_next_hook(hooks, i+1, args, done)
        }
    })
    
    hook.apply(null, hook_args)
}