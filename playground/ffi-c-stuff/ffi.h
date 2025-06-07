#ifdef FFI_EXPORTS
  #define FFI_API __declspec(dllexport)
#else
  #define FFI_API __declspec(dllimport)
#endif

FFI_API int   __cdecl add(int a, int b);
FFI_API char* __cdecl hello_world();