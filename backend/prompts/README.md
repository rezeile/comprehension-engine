# Prompt Management System

This directory contains the prompt management system for the Comprehension Engine. It allows you to easily manage, switch between, and experiment with different system prompts.

## Structure

- `__init__.py` - Package initialization and exports
- `base_prompts.py` - Base prompt class and current system prompt
- `prompt_variants.py` - Prompt variant manager and switching logic
- `README.md` - This documentation file

## Usage

### Basic Usage

```python
from prompts import prompt_manager

# Get the currently active prompt
active_prompt = prompt_manager.get_active_prompt()

# Switch to a different variant
prompt_manager.set_active_variant("socratic_v1")

# List all available variants
variants = prompt_manager.list_variants()
```

### API Endpoints

The system provides several admin endpoints for managing prompts:

- `GET /api/admin/prompts` - List all prompt variants
- `GET /api/admin/prompts/{variant_name}` - Get specific variant info
- `POST /api/admin/prompts/{variant_name}/activate` - Activate a variant
- `GET /api/admin/prompts/status` - Get system status

### Configuration

Environment variables for prompt management:

```bash
PROMPT_VARIANT=socratic_v1          # Default variant to use
PROMPT_EXPERIMENT_MODE=false        # Enable A/B testing
PROMPT_EXPERIMENT_WEIGHTS=100       # Distribution weights
PROMPT_CACHE_ENABLED=true           # Enable prompt caching
PROMPT_RELOAD_ON_CHANGE=false       # Auto-reload on file changes
PROMPT_DIR=prompts                  # Prompt directory
```

## Adding New Prompts

To add a new prompt variant:

1. Create a new `BasePrompt` instance in `base_prompts.py`
2. Add it to the prompt manager
3. Use the API to activate it

Example:

```python
from prompts.base_prompts import BasePrompt

NEW_PROMPT = BasePrompt(
    name="direct_teaching",
    content="You are a direct, explanatory tutor...",
    metadata={
        "style": "direct",
        "response_length": "medium",
        "focus": "explanation"
    }
)

# Add to manager
prompt_manager.add_variant(NEW_PROMPT)
```

## Testing

Run the test script to verify the system is working:

```bash
cd backend
python test_prompts.py
```

## Current Variants

- **socratic_v1** (default): Current Socratic teaching approach with 3-sentence limit

## Future Enhancements

- A/B testing capabilities
- Performance monitoring
- Dynamic prompt generation
- Multi-language support
