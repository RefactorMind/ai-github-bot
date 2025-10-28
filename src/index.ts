import { Probot } from 'probot';
import { handleDiscussionCreated } from './handlers/discussion-handler';
import { handleDiscussionCommentCreated } from './handlers/discussion-comment-handler';
import { handlePullRequestOpened } from './handlers/pull-request-handler';
import 'dotenv/config'; // Load environment variables

/**
 * Probot application entry point.
 * This function "routes" webhook events to the correct handlers.
 * @param app The Probot application instance.
 */
export = (app: Probot) => {
  app.log.info("AI GitHub Bot is up and running!");

  // Feature 1: Answer new discussions
  app.on('discussion.created', async (context) => {
    // We use 'as any' to handle potential type mismatches in Probot's generic context
    await handleDiscussionCreated(context as any);
  });

  // Feature 2: Respond to @-mentions and "help" commands in comments
  app.on('discussion_comment.created', async (context) => {
    await handleDiscussionCommentCreated(context as any);
  });

  // Feature 3: Welcome first-time contributors
  app.on('pull_request.opened', async (context) => {
    await handlePullRequestOpened(context as any);
  });

  // You can add more listeners here for other events
  // app.on("issues.opened", async (context) => {
  //   // ... handle new issues
  // });
};

