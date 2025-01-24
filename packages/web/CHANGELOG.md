# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.6]

### Changed

- Upgrade onnx-runtime

## [1.5.0]

### Added

- Added option to execute on gpu (webgpu) and cpu. Enable by setting `device: "gpu"`

- Added isnet model for webgpu

## [1.4.5]

### Added

- Added ThirdPartyLicenses.json

## [1.4.0]

### Added

- Moved all data into it's own package. Therefore, reducing the main package size for the general case.

- Bumped onnx runtime to 1.17 Changed

- Changed license from GPL to AGPL Changed

- Added option to apply segmentation mask to any image. Used for applying the same mask to srcsets.

- Added option to apply segmentation mask to any image. Used for applying the same mask to srcsets.

### Changed

- Fallback to Canvas if OffscreenCanvas is not available

- Typescript bindings are generated with tsc

## [1.3.0]

### Added

- Resources are now chunked to 4MB for better caching performance and download restart.

- Seperate functions for `removeBackground`, `removeForeground`, and `segmentForeground`. Later will extract the mask only.

- Config option to export 'x-alpha8' format to get receive single channel alpha mask.

### Removed

- Configuration options to specify if background, foreground or mask is exported.

### Changed

- Changed the return value type of the progress callback from undefined to void

- Output is now in the original image size. Mask is upscaled and applied to the original image.

## [1.2.1]

### Added

- `CHANGELOG.md` for an better overview of the changes.

- support for raw `rgba8` export formats.

## [1.2.0]

### Added

- Support `foreground`, `background` and `mask` export type.
- Added support for `webp` and `jpeg` export formats.
