import { Context } from 'probot';
import { DiscussionCreatedEvent } from '@octokit/webhooks-types';
import { GithubService } from '../services/github-service';
import { AIService } from '../services/ai-service';

/**
 * Handles the 'discussion.created' event.
 * @param context The Probot event context.
 */
export const handleDiscussionCreated = async (
  context: Context<"discussion.created">
) => {
  const payload = context.payload as DiscussionCreatedEvent;
  const { discussion, repository } = payload;
  const octokit = context.octokit;
  const log = context.log;

  // 1. Extract information
  const owner = repository.owner.login;
  const repo = repository.name;
  const discussionNumber = discussion.number;
  const discussionNodeId = discussion.node_id; // GraphQL ID for posting replies
  const questionTitle = discussion.title;
  const questionBody = discussion.body;
  const user = discussion.user.login;

  log.info(`New discussion created by @${user} in ${owner}/${repo}: "${questionTitle}"`);

  // 2. Initialize services
  const githubService = new GithubService(octokit, log);
  const aiService = new AIService(log);
  const botUsername = await githubService.getBotUsername();

  // 3. Don't respond to self
  if (user === botUsername) {
    log.info('Discussion was created by the bot itself. Skipping.');
    return;
  }

  try {
    // 4. Post initial "thinking..." comment for good UX
    const thinkingComment = `Hello @${user}! I'm an AI assistant for this repository. 🤖

I'm currently analyzing the repository's documentation and code to find an answer to your question: **"${questionTitle}"**

I'll be back with a response shortly.`;
    
    await githubService.postDiscussionComment(discussionNodeId, thinkingComment);

    // 5. Retrieve context from the repository (RAG)
    const searchQuery = `${questionTitle} ${questionBody}`;
    const repoContext = await githubService.getContextForQuery(
      owner,
      repo,
      searchQuery
    );

    // 6. Generate an answer using the AI service
    const answer = await aiService.generateAnswer(
      repo,
      questionTitle,
      questionBody,
      repoContext
    );

    // 7. Post the final answer
    const answerSignature = `\n\n---\n*I am an AI assistant. My answer is based on the repository's content and may not be perfect. Please verify important information.*`;
    await githubService.postDiscussionComment(
      discussionNodeId,
      answer + answerSignature
    );

    log.info(`Successfully answered discussion #${discussionNumber} in ${owner}/${repo}`);

  } catch (error) {
    log.error(`Error handling discussion #${discussionNumber} in ${owner}/${repo}:`, error);
    // Post an error comment if something goes wrong
    await githubService.postDiscussionComment(
      discussionNodeId,
      `Sorry, @${user}. I encountered an error while trying to answer your question. A human collaborator will have to take a look.`
    );
  }
};

