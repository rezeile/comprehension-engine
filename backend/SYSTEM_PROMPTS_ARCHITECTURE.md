# System Prompts Architecture

## Overview

The Comprehension Engine implements a sophisticated prompt management system that enables dynamic control over AI behavior without code changes. The architecture supports multiple prompt variants, runtime switching, and future A/B testing capabilities.

## Core Components

### 1. BasePrompt Class (`base_prompts.py`)

The foundation of the prompt system. Each prompt is an instance with:

- **name**: Unique identifier (e.g., "socratic_v1")
- **content**: The actual system prompt text
- **metadata**: Structured information about the prompt's characteristics
- **version**: Prompt version tracking
- **created_at**: Timestamp for auditing

```python
DEFAULT_PROMPT = BasePrompt(
    name="socratic_v1",
    content=CURRENT_SYSTEM_PROMPT,
    metadata={
        "style": "socratic",
        "response_length": "short", 
        "focus": "questioning",
        "tone": "encouraging"
    }
)
```

### 2. PromptVariantManager (`prompt_variants.py`)

The central orchestrator that manages all prompt variants. Key responsibilities:

- **Variant Registration**: Add/remove prompt variants dynamically
- **Active Prompt Selection**: Control which prompt is currently used
- **Safe Fallbacks**: Always maintains access to the default prompt
- **Information Retrieval**: Provides metadata and status for all variants

```python
# Global singleton instance
prompt_manager = PromptVariantManager()

# Core operations
prompt_manager.add_variant(new_prompt)
prompt_manager.set_active_variant("variant_name")
active_content = prompt_manager.get_active_prompt()
```

### 3. PromptSettings (`config/settings.py`)

Environment-driven configuration system that controls prompt behavior:

```bash
PROMPT_VARIANT=socratic_v1          # Default active variant
PROMPT_EXPERIMENT_MODE=false        # A/B testing toggle
PROMPT_EXPERIMENT_WEIGHTS=100       # Distribution weights
PROMPT_CACHE_ENABLED=true           # Performance optimization
PROMPT_RELOAD_ON_CHANGE=false       # Development feature
```

## Current System Prompt

The active "socratic_v1" prompt implements a conversational tutoring approach:

### Core Philosophy
- **Socratic Method**: Teaching through guided questioning
- **Brevity**: Maximum 3 sentences per response
- **Student-Centered**: Responses driven by student's actual words and confusion
- **Shame-Free Learning**: Creating psychological safety for questions

### Teaching Strategy
1. **Assessment First**: Always start with questions to gauge understanding
2. **Compelling Relevance**: Hook attention with personally meaningful connections
3. **Foundational Building**: Progress from atoms → molecules → reactions
4. **One Concept Rule**: Full mastery before advancing
5. **Confusion as Signal**: Use student confusion to guide conversation flow

### Response Structure
- **Listen Deeply**: Respond to specific student words and confusion
- **Question-Led**: When in doubt, ask rather than explain
- **Encouraging Tone**: "Not quite, but I love that you're thinking about..."
- **Relevance Hooks**: "Your body is performing trillions of reactions right now..."

## API Integration

### Chat Endpoint Usage
```python
# In main.py chat endpoint
system_prompt = prompt_manager.get_active_prompt()

response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    system=system_prompt,  # Dynamic prompt injection
    messages=messages
)
```

### Admin Endpoints

**GET /api/admin/prompts**
- Lists all available prompt variants
- Shows active variant and configuration
- Returns variant metadata and descriptions

**GET /api/admin/prompts/{variant_name}**
- Retrieves specific variant information
- Includes metadata, version, and creation timestamp

**POST /api/admin/prompts/{variant_name}/activate**
- Switches active prompt variant
- Immediate effect on all new conversations
- Returns confirmation and new active variant

**GET /api/admin/prompts/status**
- System health check
- Active variant confirmation
- Configuration summary

## Data Flow

1. **System Startup**
   ```
   PromptSettings loads from .env → PromptVariantManager initializes → 
   DEFAULT_PROMPT registered → Active variant set
   ```

2. **Chat Request Processing**
   ```
   API request → prompt_manager.get_active_prompt() → 
   Claude API call with system prompt → Response generation
   ```

3. **Admin Operations**
   ```
   Admin API call → PromptVariantManager operation → 
   Immediate effect on subsequent chats → Status confirmation
   ```

## Safety Mechanisms

### Fallback Protection
- Default prompt always available
- Cannot delete the default variant
- Automatic fallback if active variant fails

### Validation
- Type checking for BasePrompt instances
- Variant existence verification before activation
- Graceful error handling with status messages

### Logging
- All variant operations logged to console
- Add/remove/activate operations tracked
- Status confirmations for debugging

## Testing Framework

The `test_prompts.py` script provides comprehensive validation:

### Basic Functionality Tests
- Default prompt loading verification
- Variant enumeration and metadata validation
- Configuration loading confirmation

### Error Handling Tests
- Invalid variant activation attempts
- Non-existent variant removal attempts
- Graceful degradation scenarios

### Integration Tests
- Full workflow simulation
- API endpoint response validation
- Configuration override testing

## Future Architecture Considerations

### A/B Testing Ready
The system is architected to support:
- **Weighted Distribution**: `PROMPT_EXPERIMENT_WEIGHTS` for traffic splitting
- **Experiment Mode**: Toggle for production A/B testing
- **Performance Tracking**: Foundation for variant performance comparison

### Scalability Features
- **Prompt Caching**: `PROMPT_CACHE_ENABLED` for performance optimization
- **Hot Reloading**: `PROMPT_RELOAD_ON_CHANGE` for development efficiency
- **Multi-Variant Support**: Unlimited prompt variants with metadata

### Extensibility Points
- **Custom Metadata**: Flexible metadata system for prompt classification
- **Version Control**: Built-in versioning for prompt evolution tracking
- **Plugin Architecture**: Easy addition of new prompt types and behaviors

## Best Practices

### Prompt Development
1. **Metadata Documentation**: Always include descriptive metadata
2. **Version Incrementing**: Update versions for significant changes
3. **Testing**: Validate prompts through the test framework
4. **Gradual Rollout**: Use admin APIs for controlled deployment

### Operations
1. **Monitor Active Variant**: Regular status checks via admin API
2. **Backup Strategy**: Maintain prompt version history
3. **Performance Tracking**: Monitor response quality by variant
4. **Safe Switching**: Test variants in development before production activation

## Error Scenarios and Recovery

### Common Issues
- **Missing Variant**: System falls back to default automatically
- **Invalid Configuration**: Environment validation with safe defaults
- **Memory Issues**: Lightweight prompt storage with minimal overhead

### Recovery Procedures
- **Reset to Default**: `prompt_manager.reset_to_default()`
- **Configuration Reload**: Restart with corrected environment variables
- **Manual Intervention**: Direct database/file system prompt recovery

This architecture provides a robust, scalable foundation for AI behavior management while maintaining simplicity in day-to-day operations.
