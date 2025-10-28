import { Context } from 'probot';
import { DiscussionCommentCreatedEvent } from '@octokit/webhooks-types';
import { GithubService } from '../services/github-service';
import { AIService } from '../services/ai-service';

/**
 * Handles the 'discussion_comment.created' event.
 * Responds to @-mentions of the bot.
 * @param context The Probot event context.
 */
export const handleDiscussionCommentCreated = async (
  context: Context<"discussion_comment.created">
) => {
  const payload = context.payload as DiscussionCommentCreatedEvent;
  const { discussion, comment, repository } = payload;
  const octokit = context.octokit;
  const log = context.log;

  // 1. Initialize services
  const githubService = new GithubService(octokit, log);
  const aiService = new AIService(log);

  // 2. Get bot's username to check for mentions
  const botUsername = await githubService.getBotUsername();

  // 3. Check if the bot was mentioned and not by itself
  const commentBody = comment.body;
  const mentioned = commentBody.includes(`@${botUsername}`);
  const isBotComment = comment.user.login === botUsername;

  if (!mentioned || isBotComment) {
    log.info('Bot not mentioned or is bot\'s own comment. Skipping.');
    return;
  }

  log.info(`Bot was mentioned in discussion #${discussion.number} by @${comment.user.login}`);

  // 4. Extract key info
  const owner = repository.owner.login;
  const repo = repository.name;
  const discussionNodeId = discussion.node_id; // GraphQL ID for replies
  const user = comment.user.login;
  // Clean the comment body to get just the question
  const userQuestion = commentBody.replace(`@${botUsername}`, '').trim();

  try {
    // 5. Check for "help" command
    if (userQuestion.toLowerCase().includes('help')) {
      log.info('Help command detected.');
      const helpMessage = aiService.generateHelpMessage(user);
      await githubService.postDiscussionComment(discussionNodeId, helpMessage);
      return;
    }

    // 6. Post "thinking..." comment
    await githubService.postDiscussionComment(
      discussionNodeId,
      `Thanks for the follow-up, @${user}! I'm looking into that for you. 🤖`
    );

    // 7. Get context, including the original discussion
    const discussionContext = `
      --- ORIGINAL DISCUSSION TITLE ---
      ${discussion.title}

      --- ORIGINAL DISCUSSION BODY ---
      ${discussion.body}
    `;
    const repoContext = await githubService.getContextForQuery(
      owner,
      repo,
      userQuestion
    );

    // 8. Generate follow-up answer
    const answer = await aiService.generateFollowUpAnswer(
      repo,
      discussionContext,
      userQuestion,
      repoContext
    );

    // 9. Post the final answer
    const answerSignature = `\n\n---\n*I am an AI assistant. My answer is based on the repository's content and may not be perfect.*`;
    await githubService.postDiscussionComment(
      discussionNodeId,
      answer + answerSignature
    );
  } catch (error) {
    log.error(`Error handling discussion comment in #${discussion.number}:`, error);
    await githubService.postDiscussionComment(
      discussionNodeId,
      `Sorry, @${user}. I encountered an error while trying to answer your follow-up question.`
    );
  }
};

