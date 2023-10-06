- [ ] Provide typescript bindings
- [x] Provide access to filesystem for nodejs version
- [ ] Update build script to external dependencies from `package.json`
- [ ] use logger callback instead of `console.log`
  ```
    logger: (level, message: string, args...) => void
  ```
- [ ] use resolver callback instead of publicPath as such we can allow various
  ```
      resolve: (path: string) => Response
  ```
- [ ] use decode callback to allow different types of image decoders
  ```
      decode: (buffer: Uint8Array, mimetype: string) => Uint8Array
  ```
- [ ] use encode callback to allow differnt types of image encoders

  ```
      encode: (buffer: Uint8Array, mimetype: string) => Uint8Array
  ```

- [ ] use zod to check each api endpoint and not just the config. This will allow checking the input and the output
