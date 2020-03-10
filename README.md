# cyan

a monadic link

## synposis

`cyan` is a monadic link function similar in spirit to `$`, `_`, etc.

## goals

Expressions should be well-typed throughout the scope of the link, so far as that's possible
with certain APIs.

Links like the following should be well-typed at every layer:

```
  cyan.wrap(2+2).invokes('toString').expect().toBe('4')
  cyan.expect({a: { b: 3 }}).glom('a', 'b').apply(x => x*x).toBe(9)
```

## design / api structure

The initial thought is to model most things in terms of a simple `Box` that wraps around a value.

Further iterations that need more complex control over the subject should descend from `Box`
and overwrite types/definitions appropriately. (Yes, this is a lot, but it means well-typed links throughout.)

For instance, `Expectation` descends from `Box` and reimplements core methods so that it can
return an expectation. Any thoughts on a cleaner implementation here welcome!