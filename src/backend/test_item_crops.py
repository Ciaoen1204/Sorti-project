import io
import unittest
from PIL import Image
from item_crops import crop_items
import base64

class ItemCropTest(unittest.TestCase):
    def test_distinct_crops_and_clipped_bounds(self):
        image = Image.new('RGB', (100, 60), 'red')
        image.paste('blue', (50, 0, 100, 60))
        source = io.BytesIO()
        image.save(source, 'PNG')
        boxes = [dict(name='物品', category='用品', x=x, y=0, width=.5, height=1) for x in [0, .5]]
        crops = crop_items(source.getvalue(), boxes)
        self.assertEqual(len(crops), 2)
        pixels = []
        for crop in crops:
            thumbnail = Image.open(io.BytesIO(base64.b64decode(crop['photoUri'].split(',')[1])))
            self.assertEqual(thumbnail.size, (50, 60))
            pixels.append(thumbnail.getpixel((25, 30)))
        self.assertGreater(pixels[0][0], 240)
        self.assertGreater(pixels[1][2], 240)
        with self.assertRaises(ValueError):
            crop_items(source.getvalue(), [dict(boxes[0], width=0)])
        with self.assertRaises(ValueError):
            crop_items(source.getvalue(), [dict(boxes[0], x=float('nan'))])

    def test_camera_orientation(self):
        image = Image.new('RGB', (100, 60), 'red')
        exif = image.getexif()
        exif[274] = 6
        source = io.BytesIO()
        image.save(source, 'JPEG', exif=exif)
        crops = crop_items(source.getvalue(), [dict(name='物品', x=0, y=0, width=1, height=1)])
        thumbnail = Image.open(io.BytesIO(base64.b64decode(crops[0]['photoUri'].split(',')[1])))
        self.assertEqual(thumbnail.size, (60, 100))

if __name__ == '__main__':
    unittest.main()
