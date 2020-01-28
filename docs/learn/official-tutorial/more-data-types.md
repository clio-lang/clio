# More data types

## Lists

A list is a generator in Clio. Generators are lazy and indexable. Lists are defined like this:

```text
[1 2 3 4] => my_list
my_list -> print
```

Clio supports multi-dimensional indexing:

```text
-- this is a comment
[[1 2 3]
 [4 5 6]
 [7 8 9]] => my_list

my_list[1 1] -> print   -- 2nd row 2nd col!
```

You will learn more about indexing in next chapter, for now let's learn a little more about the data types.

## Ranges

Ranges are also generators, it means they're lazy and indexable. Here's how we can define a range:

```text
[0:5] -> * print          -- from 0 to 5
[0:10:2] -> * print       -- from 0 to 10, step is 2
[::2] => evens            -- from 0 to infinity, step is 2
      -- ^ all of the even numbers!

evens[[0:10]] -> * print  -- first 10 even numbers | bug!
```

## Hash maps

Hash maps are similar to lists, except that there are keys instead of indexes:

```text
{
  #key1   #value1
  #key2   #value2
} => my_map

my_map.key1 -> print
```

To learn how to create your own custom data types, proceed to next part.

