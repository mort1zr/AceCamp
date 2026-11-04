import cv2

from court.refinement import refine_keypoints


class CourtLineDetector:
    def __init__(self, model_path, refine=True):
        # torch se importa aquí para que el resto del paquete (CLI, tests) no lo necesite.
        import torch
        import torchvision.transforms as transforms
        from torchvision import models

        self._torch = torch
        self.refine = refine
        # weights=None: los pesos de ImageNet no hacen falta, se sobrescriben con los entrenados.
        self.model = models.resnet50(weights=None)
        self.model.fc = torch.nn.Linear(self.model.fc.in_features, 14*2)
        self.model.load_state_dict(torch.load(model_path, map_location='cpu', weights_only=True))
        self.model.eval()  # sin dropout ni actualización de batch norm al predecir
        self.transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

    def predict(self, image):
        """14 puntos clave [x0, y0, ..., x13, y13] en píxeles del fotograma."""
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        image_tensor = self.transform(image_rgb).unsqueeze(0)
        with self._torch.no_grad():
            outputs = self.model(image_tensor)
        keypoints = outputs.squeeze().cpu().numpy()
        original_h, original_w = image.shape[:2]
        keypoints[::2] *= original_w / 224.0
        keypoints[1::2] *= original_h / 224.0

        if self.refine:
            keypoints = refine_keypoints(image, keypoints)
        return keypoints

    def draw_keypoints(self, image, keypoints):
        # Plot keypoints on the image
        for i in range(0, len(keypoints), 2):
            x = int(keypoints[i])
            y = int(keypoints[i+1])
            cv2.putText(image, str(i//2), (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
            cv2.circle(image, (x, y), 5, (0, 0, 255), -1)
        return image
    
    def draw_keypoints_on_video(self, video_frames, keypoints_per_frame):
        """Dibuja en cada fotograma sus puntos clave (una lista de puntos clave por fotograma)."""
        return [self.draw_keypoints(frame, keypoints) for frame, keypoints in zip(video_frames, keypoints_per_frame)]