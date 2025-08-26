# Memory Configuration Guide

This document explains the enhanced memory system for your WoW Character Gear Agent, including semantic recall and working memory capabilities.

## Overview

Your agent now has three complementary memory layers that work together:

1. **Basic Memory**: Stores conversation history and thread management
2. **Semantic Recall**: Finds relevant past conversations using vector search
3. **Working Memory**: Maintains persistent user profiles and preferences

## Privacy & Scope

- **Per‑User Isolation**: Conversations and memory are scoped to a single user (the "resource"). The agent cannot access, reference, or become aware of other users' conversations or data.
- **What "resource" means**: A resource is the unique identifier you pass to the agent (e.g., in Discord we use `message.author.id`). All memory lookups and updates are keyed to this ID.
- **Cross‑thread continuity**: With `scope: resource`, memory persists across all threads for the same user, but never across different users.
- **User reminders**: The system prompt instructs the agent to politely remind users of this privacy scope when relevant (e.g., when someone expects cross‑user or cross‑channel memory), and to avoid over‑reminding otherwise.

## Environment Variables

### Basic Memory Settings

```bash
# Number of recent messages to include in context (default: 40)
MEMORY_MAX_MESSAGES=40
```

### Semantic Recall Configuration

```bash
# Enable/disable semantic recall (default: true)
MEMORY_SEMANTIC_RECALL_ENABLED=true

# Number of most similar messages to retrieve (default: 5)
MEMORY_SEMANTIC_RECALL_TOP_K=5

# Number of messages to include before/after each semantic match (default: 3)
MEMORY_SEMANTIC_RECALL_MESSAGE_RANGE=3

# Scope for semantic search (default: resource)
# - 'thread': Search within current conversation only
# - 'resource': Search across all conversations for the same user (recommended)
MEMORY_SEMANTIC_RECALL_SCOPE=resource
```

### Working Memory Configuration

```bash
# Enable/disable working memory (default: true)
MEMORY_WORKING_MEMORY_ENABLED=true

# Scope for working memory (default: resource)
# - 'thread': Memory isolated per conversation
# - 'resource': Memory persists across all conversations for the same user (recommended)
MEMORY_WORKING_MEMORY_SCOPE=resource

# Custom working memory template (optional)
# Uses default WoW template if not specified
MEMORY_WORKING_MEMORY_TEMPLATE="# Custom Template\n- Field 1:\n- Field 2:"
```

## How Memory Features Work Together

### 1. Basic Memory (Existing)

- **Purpose**: Stores conversation history and manages threads
- **Data**: All messages in chronological order
- **Usage**: Provides immediate context for current conversation
- **Storage**: `mastra_messages` and `mastra_threads` tables

### 2. Semantic Recall (New)

- **Purpose**: Finds relevant past conversations using AI embeddings
- **Data**: Searches through the user's stored messages for semantic similarity (scoped by `resourceId`)
- **Usage**: Retrieves contextually relevant information from past interactions
- **Storage**: Uses `mastra_vectors` table for embeddings
- **Example**: When user asks about "rogue gear," finds previous rogue discussions

### 3. Working Memory (New)

- **Purpose**: Maintains persistent user profiles and preferences
- **Data**: Structured information about user's WoW preferences
- **Usage**: Provides personalized recommendations and context
- **Storage**: `mastra_resources` table (keyed by `resourceId`)
- **Example**: Remembers user's favorite classes, preferred difficulty, etc.

## Memory Flow Example

```
User: "What's the best gear for my rogue?"
    ↓
1. Basic Memory: "Show last 40 messages from this thread"
2. Semantic Recall: "Find 5 most similar messages about rogues/gear"
3. Working Memory: "Show user's preferred difficulty and playstyle"
4. Agent gets: [Recent History] + [Rogue Gear Discussions] + [User Preferences]
5. Agent responds with personalized recommendation
6. Working Memory updated with new rogue gear discussion
```

## Default WoW Working Memory Template

The agent uses this structured template to track user information:

```markdown
# WoW Player Profile

## Character Information

- **Character Name**:
- **Server/Region**:
- **Favorite Classes**:
- **Current Main**:

## Playstyle & Preferences

- **Primary Game Mode**: [Mythic+, Raid, PvP, Casual]
- **Gear Focus**: [BiS, Good Enough, Transmog]
- **Difficulty Preference**: [Easy, Normal, Heroic, Mythic]

## Current Goals & Context

- **Current Goals**:
- **Last Character Lookup**:
- **Recent Topics Discussed**:
- **Open Questions**:

## User Preferences

- **Communication Style**: [Detailed, Concise, Technical, Casual]
- **Information Depth**: [Basic, Standard, Advanced]
- **Update Frequency**: [Always Fresh, Cached OK]
```

## Configuration Examples

### Minimal Configuration (Use Defaults)

```bash
# All features enabled with default settings
MEMORY_SEMANTIC_RECALL_ENABLED=true
MEMORY_WORKING_MEMORY_ENABLED=true
```

### Performance-Focused Configuration

```bash
# Reduce semantic search overhead
MEMORY_SEMANTIC_RECALL_TOP_K=3
MEMORY_SEMANTIC_RECALL_MESSAGE_RANGE=2
MEMORY_MAX_MESSAGES=20
```

### Thread-Isolated Configuration

```bash
# Keep memory separate per conversation
MEMORY_SEMANTIC_RECALL_SCOPE=thread
MEMORY_WORKING_MEMORY_SCOPE=thread
```

### Resource-Shared Configuration (Recommended)

```bash
# Share memory across all conversations for the same user
MEMORY_SEMANTIC_RECALL_SCOPE=resource
MEMORY_WORKING_MEMORY_SCOPE=resource
```

## Performance Considerations

### Semantic Recall Impact

- **Latency**: Adds ~100-500ms for embedding generation and vector search
- **Storage**: Requires vector database storage for embeddings
- **CPU**: FastEmbed runs locally, minimal CPU impact

### Working Memory Impact

- **Latency**: Minimal impact (simple database queries)
- **Storage**: Small overhead for user profile data
- **CPU**: Negligible impact

### Optimization Tips

- Use `MEMORY_SEMANTIC_RECALL_TOP_K=3` for faster responses
- Set `MEMORY_MAX_MESSAGES=20` if conversation history is sufficient
- Consider `MEMORY_SEMANTIC_RECALL_SCOPE=thread` for high-traffic scenarios

## Troubleshooting

### Memory Not Working

1. Check that `resourceId` and `threadId` are provided in agent calls
2. Verify environment variables are set correctly
3. Check database permissions and file paths
4. Ensure each user maps to a consistent `resourceId` (e.g., Discord `author.id`)

### Performance Issues

1. Reduce `MEMORY_SEMANTIC_RECALL_TOP_K` value
2. Disable semantic recall temporarily: `MEMORY_SEMANTIC_RECALL_ENABLED=false`
3. Check FastEmbed installation and dependencies

### Data Persistence

1. Ensure database file paths are correct and writable
2. Check storage adapter configuration
3. Verify vector store connection

## Migration Notes

- **Existing Data**: All current conversation history is preserved
- **Backward Compatibility**: Basic memory continues to work as before
- **New Features**: Semantic recall and working memory are additive
- **No Conflicts**: New features don't interfere with existing functionality

## Implementation Notes

- The agent prompt includes explicit guidance about privacy and scope so it clarifies limitations only when relevant.
- In the Discord adapter, `resourceId` is set to the message author's ID and `threadId` is prefixed with `discord-<author.id>`, ensuring per‑user isolation across channels.

## Testing the Memory System

1. **Start a conversation** and ask about WoW topics
2. **Check working memory** updates in agent responses
3. **Start a new thread** and verify memory persistence
4. **Ask related questions** to test semantic recall
5. **Verify personalization** based on stored preferences

## Support

For issues or questions about the memory system:

- Check environment variable configuration
- Review database connectivity
- Test with minimal configuration first
- Enable tracing to see memory retrieval in action
