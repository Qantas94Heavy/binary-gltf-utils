README
======

The [binary-gltf-utils](https://www.npmjs.com/package/binary-gltf-utils) module allows you to
convert plain GLTF files with separate assets to a single, bundled Binary GLTF file.

    Usage: gltf-to-glb <file> [options]

    Options:
      -e, --embed  embeds textures or shaders into binary GLTF file
                                            [array] [choices: "textures", "shaders"]
      --cesium     OBSOLETE (has no effect, no longer required by Cesium)  [boolean]
      -h, --help   Show help                                               [boolean]


Licence: MIT (see COPYRIGHT.md for details)

### Changes since 1.1.1

 - Fix embedding of image textures
 - Add support for `--embed` option without further arguments
 - Fix binary GLTF file generation for files without `images` or `shaders`
 - Add `binary_glTF` buffer definition to all files
 - The `--cesium` flag is obsolete and no longer has any effect. Cesium 1.20+ has changed its
   Binary GLTF reader to be specification compliant.
