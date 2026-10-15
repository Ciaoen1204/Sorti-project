import base64
import io
import math
from PIL import Image, ImageOps


def crop_items(image_bytes: bytes, boxes: list[dict]) -> list[dict]:
    if len(boxes) > 100:
        raise ValueError('一次最多匯入 100 件物品。')
    crops = []
    with Image.open(io.BytesIO(image_bytes)) as original:
        image = ImageOps.exif_transpose(original)
        image.load()
        for box in boxes:
            values = [float(box[key]) for key in ('x', 'y', 'width', 'height')]
            if not all(math.isfinite(value) for value in values):
                raise ValueError('物品範圍無效，請重新辨識。')
            x, y, width, height = values
            if width <= 0 or height <= 0:
                raise ValueError('物品範圍無效，請重新辨識。')
            left = max(0, min(image.width, math.floor(x * image.width)))
            top = max(0, min(image.height, math.floor(y * image.height)))
            right = max(0, min(image.width, math.ceil((x + width) * image.width)))
            bottom = max(0, min(image.height, math.ceil((y + height) * image.height)))
            if right <= left or bottom <= top:
                raise ValueError('物品範圍超出照片，請重新辨識。')
            crop = image.crop((left, top, right, bottom)).convert('RGB')
            crop.thumbnail((640, 640))
            output = io.BytesIO()
            crop.save(output, format='JPEG', quality=85)
            crops.append({
                'name': str(box['name']), 'category': str(box.get('category') or '未分類'),
                'photoUri': 'data:image/jpeg;base64,' + base64.b64encode(output.getvalue()).decode('ascii'),
            })
    return crops
