filename="photo-1686002359940-6a51b0d64f68.jpeg"
basename="${filename%.*}"

cp "$filename" "$filename".orig
magick "$filename" "$basename".png
magick "$filename" "$basename".webp
magick "$filename" "$basename".jpg
magick "$filename" "$basename".avif
magick "$filename" "$basename".heif

# Raw RGB
magick "$filename" -depth 8 "$basename".rgb
magick "$filename" -depth 8 "$basename".cmyk

# rgb to tensor 

magick "$filename" "$basename".pdf
magick "$filename" "$basename".psd


