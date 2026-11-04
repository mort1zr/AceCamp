
def convert_pixel_distance_to_meters(pixel_distance, refrence_height_in_meters, refrence_height_in_pixels):
    return (pixel_distance * refrence_height_in_meters) / refrence_height_in_pixels

def convert_meters_to_pixel_distance(meters, refrence_height_in_meters, refrence_height_in_pixels):
    return (meters * refrence_height_in_pixels) / refrence_height_in_meters

def frames_to_seconds(num_frames, fps):
    return num_frames / fps


def speed_km_per_hour(distance_in_meters, num_frames, fps):
    """Velocidad media en km/h de un recorrido que dura num_frames fotogramas."""
    return distance_in_meters / frames_to_seconds(num_frames, fps) * 3.6
