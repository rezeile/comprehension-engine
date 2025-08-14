"""
Prompts package for the Comprehension Engine.
Contains prompt management, variants, and configuration.
"""

from .base_prompts import BasePrompt
from .prompt_variants import PromptVariantManager, prompt_manager

__all__ = ['BasePrompt', 'PromptVariantManager', 'prompt_manager']
