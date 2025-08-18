# System Prompt Refactoring Plan

## Overview
Currently, the system prompt is hardcoded in `backend/main.py` as a long string variable. This makes it difficult to experiment with different prompt variations, A/B test different approaches, or maintain multiple prompt versions. This plan outlines a refactoring approach to make system prompts configurable, maintainable, and easily testable.

## Current State
- **Location**: `backend/main.py` lines 168-207
- **Structure**: Single hardcoded string variable `system_prompt`
- **Content**: Socratic teaching approach with specific response style guidelines
- **Usage**: Directly passed to Claude API call

## Goals
1. **Modularity**: Separate prompts from application logic
2. **Configurability**: Easy switching between different prompt versions
3. **Maintainability**: Centralized prompt management
4. **Experimentation**: A/B testing capabilities
5. **Version Control**: Track prompt changes and performance

## Proposed Architecture

### 1. Prompt Configuration Structure
```
backend/
├── prompts/
│   ├── __init__.py
│   ├── base_prompts.py          # Core prompt definitions
│   ├── prompt_variants.py       # Different prompt versions
│   ├── prompt_config.py         # Configuration management
│   └── prompt_loader.py         # Dynamic prompt loading
├── config/
│   ├── __init__.py
│   └── settings.py              # Environment-based configuration
└── main.py                      # Updated to use prompt system
```

### 2. Prompt Management Classes

#### Base Prompt Class
```python
class BasePrompt:
    def __init__(self, name: str, content: str, metadata: dict = None):
        self.name = name
        self.content = content
        self.metadata = metadata or {}
        self.created_at = datetime.now()
        self.version = "1.0"
    
    def get_content(self) -> str:
        return self.content
    
    def get_metadata(self) -> dict:
        return self.metadata
```

#### Prompt Variant Manager
```python
class PromptVariantManager:
    def __init__(self):
        self.variants = {}
        self.active_variant = None
    
    def add_variant(self, variant: BasePrompt):
        self.variants[variant.name] = variant
    
    def set_active_variant(self, variant_name: str):
        if variant_name in self.variants:
            self.active_variant = variant_name
    
    def get_active_prompt(self) -> str:
        if self.active_variant and self.active_variant in self.variants:
            return self.variants[self.active_variant].get_content()
        return self.get_default_prompt()
```

### 3. Configuration Options

#### Environment Variables
```bash
# .env file additions
PROMPT_VARIANT=default                    # Which prompt variant to use
PROMPT_EXPERIMENT_MODE=false              # Enable A/B testing
PROMPT_EXPERIMENT_WEIGHTS=50,50           # Distribution weights for variants
PROMPT_CACHE_ENABLED=true                 # Cache prompts for performance
PROMPT_RELOAD_ON_CHANGE=true             # Auto-reload prompts when files change
```

#### Configuration File
```python
# config/settings.py
class PromptSettings:
    DEFAULT_VARIANT = "socratic_v1"
    EXPERIMENT_MODE = False
    EXPERIMENT_WEIGHTS = {"socratic_v1": 50, "socratic_v2": 50}
    CACHE_ENABLED = True
    RELOAD_ON_CHANGE = True
    PROMPT_DIR = "prompts"
```

### 4. Prompt Variants Structure

#### Core Variants
1. **Socratic V1** (Current): Focus on question-based learning
2. **Socratic V2**: Enhanced with more specific examples
3. **Direct Teaching**: More explanatory, less questioning
4. **Storytelling**: Narrative-based learning approach
5. **Problem-Solving**: Focus on practical application

#### Variant Definition Example
```python
# prompts/prompt_variants.py
SOCRATIC_V1 = BasePrompt(
    name="socratic_v1",
    content="""You are a conversational tutor focused on helping students truly understand concepts through Socratic dialogue...""",
    metadata={
        "style": "socratic",
        "response_length": "short",
        "focus": "questioning",
        "tone": "encouraging"
    }
)

SOCRATIC_V2 = BasePrompt(
    name="socratic_v2",
    content="""You are an advanced Socratic tutor who combines deep questioning with strategic scaffolding...""",
    metadata={
        "style": "socratic_enhanced",
        "response_length": "medium",
        "focus": "questioning + scaffolding",
        "tone": "professional"
    }
)
```

### 5. Implementation Steps

#### Phase 1: Basic Refactoring
1. Create prompt directory structure
2. Extract current prompt to `base_prompts.py`
3. Create `PromptVariantManager` class
4. Update `main.py` to use the new system
5. Test basic functionality

#### Phase 2: Configuration & Variants
1. Add environment-based configuration
2. Create multiple prompt variants
3. Implement variant switching
4. Add metadata and versioning
5. Test variant switching

#### Phase 3: Advanced Features
1. Implement A/B testing
2. Add prompt performance tracking
3. Create prompt validation system
4. Add prompt analytics
5. Implement prompt caching

#### Phase 4: Monitoring & Optimization
1. Add prompt usage metrics
2. Implement performance monitoring
3. Create prompt effectiveness scoring
4. Add automated prompt optimization suggestions
5. Implement prompt rollback capabilities

### 6. API Endpoints for Prompt Management

#### Admin Endpoints
```python
@app.get("/api/admin/prompts")
async def list_prompts():
    """List all available prompt variants"""

@app.get("/api/admin/prompts/{variant_name}")
async def get_prompt(variant_name: str):
    """Get specific prompt variant"""

@app.post("/api/admin/prompts")
async def create_prompt(prompt_data: PromptCreateRequest):
    """Create new prompt variant"""

@app.put("/api/admin/prompts/{variant_name}")
async def update_prompt(variant_name: str, prompt_data: PromptUpdateRequest):
    """Update existing prompt variant"""

@app.post("/api/admin/prompts/{variant_name}/activate")
async def activate_prompt(variant_name: str):
    """Set prompt variant as active"""

@app.post("/api/admin/prompts/experiment")
async def start_experiment(experiment_config: ExperimentConfig):
    """Start A/B testing with multiple variants"""
```

### 7. Testing Strategy

#### Unit Tests
- Prompt loading and validation
- Variant switching logic
- Configuration management
- Error handling

#### Integration Tests
- End-to-end prompt delivery
- API endpoint functionality
- Configuration changes
- Variant switching

#### A/B Testing
- Random variant assignment
- Performance comparison
- Statistical significance testing
- User experience metrics

### 8. Monitoring & Analytics

#### Metrics to Track
- Prompt response quality scores
- User engagement metrics
- Learning outcome measurements
- Response time and performance
- Error rates and fallbacks

#### Dashboard Features
- Real-time prompt performance
- Variant comparison charts
- User feedback aggregation
- A/B test results
- Prompt effectiveness trends

### 9. Migration Strategy

#### Backward Compatibility
- Maintain current API behavior
- Default to current prompt if no variant specified
- Gradual rollout of new features
- Fallback mechanisms for errors

#### Rollback Plan
- Version control for all prompts
- Quick revert capabilities
- Performance monitoring alerts
- Automated rollback triggers

### 10. Future Enhancements

#### Advanced Features
- Dynamic prompt generation based on user context
- Machine learning-based prompt optimization
- Multi-language prompt support
- Personalized prompt adaptation
- Real-time prompt performance feedback

#### Integration Possibilities
- Prompt marketplace for educators
- Community-driven prompt improvements
- Automated prompt testing frameworks
- Cross-platform prompt sharing

## Implementation Timeline

- **Week 1-2**: Phase 1 - Basic refactoring
- **Week 3-4**: Phase 2 - Configuration & variants
- **Week 5-6**: Phase 3 - Advanced features
- **Week 7-8**: Phase 4 - Monitoring & optimization

## Success Metrics

1. **Development Efficiency**: 50% reduction in prompt modification time
2. **Testing Capability**: Ability to test 5+ prompt variants simultaneously
3. **Performance**: No degradation in response time
4. **Maintainability**: Centralized prompt management
5. **Experimentation**: Easy A/B testing setup

## Risk Mitigation

1. **Performance Impact**: Implement caching and lazy loading
2. **Complexity**: Start with simple implementation, add features incrementally
3. **Testing Overhead**: Automated testing and monitoring
4. **User Experience**: Maintain current behavior as default
5. **Data Loss**: Comprehensive backup and version control

## Conclusion

This refactoring plan provides a robust foundation for managing system prompts in a scalable, maintainable way. The modular approach allows for easy experimentation while maintaining system stability and performance. The phased implementation ensures minimal disruption to existing functionality while building toward advanced features like A/B testing and automated optimization.
