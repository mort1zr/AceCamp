from config import MODEL_DIR, config_from_args, load_config, resolve_path


def test_default_config_file_loads():
    config = load_config()

    assert config["paths"]["input"] == "input_videos/input_video.mp4"
    assert config["detection"]["ball_confidence"] == 0.15
    assert config["use_cache"] is False


def test_yaml_values_override_defaults_and_keep_the_rest(tmp_path):
    custom = tmp_path / "config.yaml"
    custom.write_text("detection:\n  ball_confidence: 0.3\n")

    config = load_config(custom)

    assert config["detection"]["ball_confidence"] == 0.3
    assert config["detection"]["device"] is None
    assert config["models"]["ball"] == "models/yolo5_last.pt"


def test_command_line_overrides_config():
    config = config_from_args(["--input", "otro.mp4", "--device", "cpu", "--use-cache"])

    assert config["paths"]["input"] == "otro.mp4"
    assert config["detection"]["device"] == "cpu"
    assert config["use_cache"] is True


def test_relative_paths_resolve_from_model_dir(tmp_path):
    assert resolve_path("models/x.pt") == MODEL_DIR / "models/x.pt"
    assert resolve_path(tmp_path / "x.pt") == tmp_path / "x.pt"
