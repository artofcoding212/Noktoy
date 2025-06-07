# The Noktoy Programming language
> A toy programming language designed to be *fun* and *familiar* to code in.\
Noktoy features a unique syntax that has never been seen before, and borrows language concepts from languages like Rust, Zig, Python, TypeScript, and C.\
<table>
  <tr>
    <td style="vertical-align: center; width: 50%; padding-left: 15px; padding-right: 40px;">
      <h3>Learn by example</h3>
    </td>
    <td style="vertical-align: center; padding-left: 40px; padding-right: 0px; width: 50%;">
      
```rs
use Std::{
    Io::println as print,
    Array::len,
}

str Person {
    name String
    job String
    age Number
    descendants Person[]

    !child(name: String, age: Number) Person {
        Person { name -> name, job -> "Jobless", age -> age, descendants -> [] }
    }

    blogPost(self: Person) String {
        mut buf: String = ""
        for i, d of self.descendants {
            buf = buf..d.name
            if i+2 < len(self.descendants) {
                buf = buf..", "
            } els if i == len(self.descendants)-2 {
                buf = buf.." and "
            }
        }
        "# I just graduated at age "..self.age.."!\n"..
        "I'm pursuing a career of "..self.job..".\n"..
        "I hope my children "..buf.." have a bright future ahead of them!"
    }
}

print((Person { 
    name -> "John Smith", 
    job -> "programming",
    age -> 69, 
    descendants -> [
        Person.child("Berry Reader", 0.420),
        Person.child("Jenna Tailia", 6.7)
    ]
}):blogPost())
```
  </tr>
</table>

# Why Noktoy?
## Pros

### No Hidden Control Flow
Your code does exactly what you tell it to do.\
Unlike languages like C++, something simple like an addition operation does only addition.

### No Global Scope Floods
We only have one entry into the global scope: `Std`.\
Thanks to the `use` system we borrowed from Rust, you can call our standard entries whatever you want, instead of doing archaic things like `println = print` in Python.

### Extensive Foreign Function Interface (FFI) Library
Though Noktoy is already Turing-complete, you can make it do even *more* thanks to our extensive FFI library.\
Your favorite C libraries, as well as TypeScript libraries can freely interact with noktoy thanks to our extensive FFI library.

### True Multithreading
Thanks to Deno's Workers, you can achieve true multithreading in Noktoy, and you can even send messages between threads.\
By disallowing any form of sharing variables and/or other data between threads, you cannot make race conditions.

### JavaScript Inherited Features
This sounds bad, I know, but it's really better than you think. Noktoy inherits features like the JS event loop, garbage collection, and Noktoy even inherits JS's optimizations (you can see this in action by typing one expression into the REPL and then typing another and seeing the insane performance difference).


### Familiarity
You probably come from a different programming language since you're reading our README.\
Here are some things that were inspired by programming languages that you might've came from.
| Language     | Features Noktoy has that they have |
|--------------|-----------------------------------|
| Go           | `Std::Array` entries don't mutate the array but return a copy of it with the mutations applied
| Rust         | Tags (not enums!), the `::` operator, `use` keyword, matching with `mat`, and immutability by default
| TS/JS        | Error throwing with `err` and catching with `cat`, our type system, maps/records/objects, garbage collection, the event loop, multithreading behavior, our `Std::Math` library, HTTP capabilities. You can also interact directly with TS/JS through our `Std::FFI` library.
| Zig          | No hidden control flow, structures and structure initialization
| Lua          | `..` string concatenation operator and similar multithreading syntax
| C            | You can interact directly with C through our `Std::FFI` library
| Python       | `Std::Time` library aspects, our REPL, and similar multithreading syntax

## Cons
### Slow
I'll be the one to say it: Noktoy is *slow*. We use outdated parsing and lexing methods and a tree-walk interpreter, all of which are very slow.\
**In the end, though, we only fall behind languages like Python's and TypeScript's performance by about 1 millisecond, and JS optimization eventually makes your code performance improve over time.**

### Buggy
Our language likely contains bugs as I am just one person.\
The development teams of interpreted languages like Python are probably far more vast and knowledgeable about making interpreters than I am.

### Lack of Standard Library Entries
We don't have many standard library entries; in reality, I just implemented them as I needed them when writing examples.\
Feel free to submit PRs that add standard library entries, and I will happily merge them (if I can figure out how to)!

### Horrid Language Server
I tried to make a language server for Noktoy for VSCode, and it wasn't the greatest.\
Our language server is nowhere *near* the quality of TypeScript's or Rust's language servers.