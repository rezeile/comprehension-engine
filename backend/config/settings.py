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


class AppSettings:
    """
    Application-wide feature flags and settings for adaptive learning and DB-backed prompts.
    """

    @classmethod
    def from_env(cls) -> 'AppSettings':
        load_dotenv()
        # Default ADAPTIVE_LEARNING_ENABLED to true in dev, false in production-like envs
        is_production = (os.getenv("RAILWAY_ENVIRONMENT", "").lower() == "production") or \
                        (os.getenv("ENV", "").lower() == "production")
        adaptive_default = "false" if is_production else "true"
        return cls(
            prompts_from_db=(os.getenv("PROMPTS_FROM_DB", "false").lower() == "true"),
            prompt_cache_ttl_seconds=int(os.getenv("PROMPT_CACHE_TTL_SECONDS", "300")),
            adaptive_learning_enabled=(os.getenv("ADAPTIVE_LEARNING_ENABLED", adaptive_default).lower() == "true"),
        )

    def __init__(self, prompts_from_db: bool, prompt_cache_ttl_seconds: int, adaptive_learning_enabled: bool):
        self.prompts_from_db = prompts_from_db
        self.prompt_cache_ttl_seconds = prompt_cache_ttl_seconds
        self.adaptive_learning_enabled = adaptive_learning_enabled

    def get_feature_flags_summary(self) -> Dict[str, Any]:
        return {
            "PROMPTS_FROM_DB": self.prompts_from_db,
            "PROMPT_CACHE_TTL_SECONDS": self.prompt_cache_ttl_seconds,
            "ADAPTIVE_LEARNING_ENABLED": self.adaptive_learning_enabled,
        }


# Global app settings instance
app_settings = AppSettings.from_env()
