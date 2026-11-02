import sys
from pathlib import Path

# Los módulos del modelo se importan como en main.py, desde la carpeta model/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
