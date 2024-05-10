# Todos

## Todo 2.0

- [ ] use logger/telemetry callback instead of custom debug output
- [ ] use resolver callback instead of publicPath as such we can allow various
  ```
      resolve: (path: string) => Response
  ```
- [ ] default to `gpu`
- [ ] remove image encode and decode
- [ ] removebg should get `ImageData` and return raw `ImageData`
