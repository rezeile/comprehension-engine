"""
Prompt variant management and switching functionality.
"""

from typing import Dict, Optional, List
from .base_prompts import BasePrompt, DEFAULT_PROMPT, EMPATHETIC_TUTOR_PROMPT_INSTANCE, EMPATHETIC_TUTOR_MARKDOWN_INSTANCE


class PromptVariantManager:
    """Manages different prompt variants and handles switching between them."""
    
    def __init__(self):
        self.variants: Dict[str, BasePrompt] = {}
        self.active_variant: Optional[str] = None
        
        # Initialize with all available prompt variants
        self.add_variant(DEFAULT_PROMPT)
        self.add_variant(EMPATHETIC_TUTOR_PROMPT_INSTANCE)
        self.add_variant(EMPATHETIC_TUTOR_MARKDOWN_INSTANCE)
        
        # Set active variant based on environment configuration
        from config.settings import PromptSettings
        config = PromptSettings.from_env()
        
        # Try to set the configured variant, fallback to default if it doesn't exist
        valid_variants = [DEFAULT_PROMPT.name, EMPATHETIC_TUTOR_PROMPT_INSTANCE.name, EMPATHETIC_TUTOR_MARKDOWN_INSTANCE.name]
        if config.default_variant in valid_variants:
            self.set_active_variant(config.default_variant)
        else:
            print(f"Warning: Configured variant '{config.default_variant}' not found, using default")
            self.set_active_variant(DEFAULT_PROMPT.name)
    
    def add_variant(self, variant: BasePrompt) -> None:
        """Add a new prompt variant."""
        if not isinstance(variant, BasePrompt):
            raise ValueError("Variant must be an instance of BasePrompt")
        
        self.variants[variant.name] = variant
        print(f"Added prompt variant: {variant.name}")
    
    def remove_variant(self, variant_name: str) -> bool:
        """Remove a prompt variant."""
        if variant_name == DEFAULT_PROMPT.name:
            print(f"Cannot remove default variant: {variant_name}")
            return False
        
        if variant_name in self.variants:
            del self.variants[variant_name]
            
            # If we removed the active variant, switch to default
            if self.active_variant == variant_name:
                self.set_active_variant(DEFAULT_PROMPT.name)
            
            print(f"Removed prompt variant: {variant_name}")
            return True
        
        print(f"Variant not found: {variant_name}")
        return False
    
    def set_active_variant(self, variant_name: str) -> bool:
        """Set the active prompt variant."""
        if variant_name in self.variants:
            self.active_variant = variant_name
            print(f"Active prompt variant set to: {variant_name}")
            return True
        
        print(f"Cannot set active variant: {variant_name} not found")
        return False
    
    def get_active_prompt(self) -> str:
        """Get the content of the currently active prompt."""
        if self.active_variant and self.active_variant in self.variants:
            return self.variants[self.active_variant].get_content()
        
        # Fallback to default prompt
        return DEFAULT_PROMPT.get_content()
    
    def get_active_variant_name(self) -> str:
        """Get the name of the currently active variant."""
        return self.active_variant or DEFAULT_PROMPT.name
    
    def get_variant(self, variant_name: str) -> Optional[BasePrompt]:
        """Get a specific prompt variant by name."""
        return self.variants.get(variant_name)
    
    def list_variants(self) -> List[str]:
        """List all available variant names."""
        return list(self.variants.keys())
    
    def get_variant_info(self, variant_name: str) -> Optional[Dict]:
        """Get information about a specific variant."""
        variant = self.variants.get(variant_name)
        if variant:
            return {
                "name": variant.name,
                "version": variant.version,
                "created_at": variant.created_at.isoformat(),
                "metadata": variant.metadata,
                "is_active": variant_name == self.active_variant
            }
        return None
    
    def get_all_variants_info(self) -> List[Dict]:
        """Get information about all variants."""
        return [
            self.get_variant_info(name) 
            for name in self.variants.keys()
        ]
    
    def get_default_prompt(self) -> str:
        """Get the default prompt content."""
        return DEFAULT_PROMPT.get_content()
    
    def reset_to_default(self) -> None:
        """Reset to the default prompt variant."""
        self.set_active_variant(DEFAULT_PROMPT.name)
        print("Reset to default prompt variant")


# Global instance for easy access
prompt_manager = PromptVariantManager()
