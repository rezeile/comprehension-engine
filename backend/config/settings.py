"""
Configuration settings for prompt management.
"""

import os
from typing import Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class PromptSettings:
    """Configuration settings for prompt management."""
    
    # Default values
    DEFAULT_VARIANT = "socratic_v1"
    EXPERIMENT_MODE = False
    EXPERIMENT_WEIGHTS = {"socratic_v1": 100}  # 100% default for now
    CACHE_ENABLED = True
    RELOAD_ON_CHANGE = False  # Disabled for Phase 1
    PROMPT_DIR = "prompts"
    
    @classmethod
    def from_env(cls) -> 'PromptSettings':
        """Create settings from environment variables."""
        return cls(
            default_variant=os.getenv("PROMPT_VARIANT", cls.DEFAULT_VARIANT),
            experiment_mode=os.getenv("PROMPT_EXPERIMENT_MODE", "false").lower() == "true",
            experiment_weights=cls._parse_experiment_weights(
                os.getenv("PROMPT_EXPERIMENT_WEIGHTS", "100")
            ),
            cache_enabled=os.getenv("PROMPT_CACHE_ENABLED", "true").lower() == "true",
            reload_on_change=os.getenv("PROMPT_RELOAD_ON_CHANGE", "false").lower() == "true",
            prompt_dir=os.getenv("PROMPT_DIR", cls.PROMPT_DIR)
        )
    
    def __init__(
        self,
        default_variant: str = DEFAULT_VARIANT,
        experiment_mode: bool = EXPERIMENT_MODE,
        experiment_weights: Dict[str, int] = None,
        cache_enabled: bool = CACHE_ENABLED,
        reload_on_change: bool = RELOAD_ON_CHANGE,
        prompt_dir: str = PROMPT_DIR
    ):
        self.default_variant = default_variant
        self.experiment_mode = experiment_mode
        self.experiment_weights = experiment_weights or self.EXPERIMENT_WEIGHTS.copy()
        self.cache_enabled = cache_enabled
        self.reload_on_change = reload_on_change
        self.prompt_dir = prompt_dir
    
    @staticmethod
    def _parse_experiment_weights(weights_str: str) -> Dict[str, int]:
        """Parse experiment weights from string format."""
        try:
            if "," in weights_str:
                # Format: "variant1:50,variant2:50"
                weights = {}
                for pair in weights_str.split(","):
                    if ":" in pair:
                        variant, weight = pair.split(":")
                        weights[variant.strip()] = int(weight.strip())
                    else:
                        weights[pair.strip()] = 100
                return weights
            else:
                # Single weight value
                return {"default": int(weights_str)}
        except (ValueError, AttributeError):
            return {"default": 100}
    
    def get_config_summary(self) -> Dict[str, Any]:
        """Get a summary of current configuration."""
        return {
            "default_variant": self.default_variant,
            "experiment_mode": self.experiment_mode,
            "experiment_weights": self.experiment_weights,
            "cache_enabled": self.cache_enabled,
            "reload_on_change": self.reload_on_change,
            "prompt_dir": self.prompt_dir
        }
    
    def __str__(self) -> str:
        return f"PromptSettings(default_variant='{self.default_variant}', experiment_mode={self.experiment_mode})"
    
    def __repr__(self) -> str:
        return f"PromptSettings(default_variant='{self.default_variant}', experiment_mode={self.experiment_mode})"


# Global settings instance
prompt_settings = PromptSettings.from_env()
