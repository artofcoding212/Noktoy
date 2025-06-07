#include "./ffi.h"

int __cdecl add(int a, int b){
    return a+b;
}

char* __cdecl hello_world(){
    return (char*)"Hello, world!";
}