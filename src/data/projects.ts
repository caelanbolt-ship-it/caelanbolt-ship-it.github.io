// Project copy is transcribed from each export's content.md (selected, never strengthened).
// Assessly has no export; its copy comes from the brief Caelan provided.
import crm from './manifests/my-crm.json';
import hush from './manifests/hush.json';
import golf from './manifests/golf.json';
import face from './manifests/face-detector.json';

export interface Metric { value: string; label: string; note?: string }
export interface BuiltItem { lead: string; text: string }
export interface DiagramNode { id: string; label: string; sub?: string; col: number; row: number; tone?: 'gate' | 'mine' }
export interface Diagram {
  nodes: DiagramNode[];
  /** route 'sp' leaves through the node's top/bottom first; 'ps' enters the target's top/bottom. */
  edges: [from: string, to: string, route?: 'sp' | 'ps'][];
  /** Node ids along the main data flow; a pulse travels this path. */
  main: string[];
  caption: string;
}
export interface Shot { src: string; alt: string; width: number; height: number }
export type ProjectMedia =
  | { kind: 'video'; duration: number; label: string; posterAlt: string }
  | { kind: 'youtube'; id: string; posterAlt: string };

export interface Project {
  slug: string;
  title: string;
  tagline: string;
  kicker: string;
  pitch: string;
  chips: string[];
  stack: string[];
  problem: string[];
  built: { intro: string; items: BuiltItem[]; outro?: string };
  metrics: Metric[];
  diagram: Diagram;
  disclosure: string[];
  media: ProjectMedia;
  screenshots: Shot[];
}

type Manifest = { alt: Record<string, string>; screenshots?: string[]; dims: Record<string, { width: number; height: number }>; duration: number };

function shots(slug: string, m: Manifest): Shot[] {
  return (m.screenshots ?? []).map((rel) => ({
    src: `/media/${slug}/${rel}`,
    alt: m.alt[rel] ?? '',
    width: m.dims[rel]?.width ?? 1600,
    height: m.dims[rel]?.height ?? 900,
  }));
}

export const projects: Project[] = [
  {
    slug: 'my-crm',
    title: 'my-crm',
    tagline: 'An agentic personal operations platform',
    kicker: 'Solo project',
    pitch:
      'A personal operations platform you talk to: a Claude tool-use agent answers plain-English requests from your own email, calendar, money, fitness and trading data, and stops for your approval before anything sensitive.',
    chips: ['FastAPI', 'PostgreSQL', 'React + TypeScript', 'Claude tool use'],
    stack: ['Python', 'FastAPI', 'SQLAlchemy', 'Alembic', 'PostgreSQL', 'APScheduler', 'Anthropic Claude API (tool use)', 'React', 'TypeScript', 'Vite', 'cryptography (Fernet)', 'pytest'],
    problem: [
      "Day-to-day admin is spread across an inbox, a calendar, bank apps, a training log and trading tools. Each keeps its own data and its own interface, so answering a simple question (“what did I spend on food this month?”, “can I move Friday’s dinner?”) means opening several apps and doing the joining yourself.",
      "Generic chat assistants can’t see any of that data, and letting one act on it raises the obvious question: what stops it from doing something you didn’t mean?",
    ],
    built: {
      intro: 'my-crm pulls each source into one PostgreSQL database and puts a conversational agent in front of it.',
      items: [
        { lead: 'One workspace.', text: 'A channel bar (Mail, Calendar, Money, Fitness, Options, Props), a unified activity feed, and a full page per channel for the things that are easier to scan than to ask about.' },
        { lead: 'An agent that routes across domains.', text: 'Every integration registers its actions as tools (59 in total). The agent chooses the tools, reads the results and answers from real rows, not guesses. A Routing panel shows every tool that ran and how long it took.' },
        { lead: 'Human-in-the-loop by construction.', text: 'Tools that change something outside the app are flagged sensitive. The orchestrator refuses to run them unconfirmed and returns a “Needs your confirmation” card with the exact arguments. Nothing runs until you press Run it. Email is draft-only: there is no send code path.' },
        { lead: 'Money that adds up.', text: 'Transactions are categorised by a layered rule engine (manual rules → structural checks → merchant keywords → Plaid category), and payments to your own credit card net out instead of counting as spending twice.' },
        { lead: 'Fitness and trading.', text: 'Workout logging with set-by-set history, nutrition tracking, and AI-generated training plans saved as editable rows. A read-only view of a separate paper-trading options agent.' },
        { lead: 'Security hygiene.', text: 'Single-user session auth, Fernet encryption at rest for OAuth/Plaid tokens and for identifying free text, and secrets only from the environment.' },
      ],
    },
    metrics: [
      { value: '59', label: 'agent tools', note: '4 gated behind human approval' },
      { value: '94', label: 'REST operations', note: 'across 85 paths' },
      { value: '319', label: 'automated tests passing', note: 'full pytest run' },
      { value: '54', label: 'commits on main' },
    ],
    diagram: {
      nodes: [
        { id: 'web', label: 'React client', sub: 'Vite · TypeScript', col: 0, row: 1 },
        { id: 'api', label: 'FastAPI', sub: '94 REST operations', col: 1, row: 1 },
        { id: 'orch', label: 'Orchestrator', sub: 'Claude tool-use loop', col: 2, row: 1 },
        { id: 'claude', label: 'Claude API', sub: 'Messages · tool_use', col: 2, row: 0 },
        { id: 'reg', label: 'Tool registry', sub: '59 tools', col: 3, row: 1 },
        { id: 'gate', label: 'Confirmation gate', sub: '4 sensitive tools', col: 3, row: 0, tone: 'gate' },
        { id: 'svc', label: 'Integrations', sub: 'Gmail · Plaid · +4', col: 4, row: 1 },
        { id: 'sched', label: 'Scheduler', sub: 'APScheduler sync', col: 3, row: 2 },
        { id: 'pg', label: 'PostgreSQL', sub: 'SQLAlchemy · Alembic', col: 4, row: 2 },
      ],
      edges: [['web', 'api'], ['api', 'orch'], ['orch', 'claude'], ['orch', 'reg'], ['reg', 'gate'], ['reg', 'svc'], ['svc', 'pg'], ['sched', 'pg']],
      main: ['web', 'api', 'orch', 'reg', 'svc', 'pg'],
      caption: 'Ask: the client posts to /agent/chat, the orchestrator loops with Claude until it has an answer, and each tool call runs a service function against Postgres. Sensitive tools stop at the confirmation gate until you press Run it.',
    },
    disclosure: [
      'Recorded locally on a fictional persona (“Alex Demo”) with made-up accounts, emails, events and trades. Gmail, Calendar, Plaid and the trading agents were replaced with local fixtures for the recording.',
      'The agent’s answers are real, unedited Claude runs (Claude Haiku 4.5); waiting time is sped up (at most 2×) and trimmed.',
    ],
    media: { kind: 'video', duration: crm.duration, label: 'my-crm walkthrough: an agent answers questions from personal data, drafts an email, asks for approval before moving a calendar event, and books a generated workout.', posterAlt: crm.alt.poster },
    screenshots: shots('my-crm', crm as Manifest),
  },
  {
    slug: 'hush',
    title: 'Hush',
    tagline: 'AI-personalized audio fiction',
    kicker: 'Independent startup · pre-launch',
    pitch:
      'Hush writes an original story from the listener’s own preferences (genre, story elements, tone, length, narrator) and reads it back as a fully narrated audio story.',
    chips: ['FastAPI', 'Server-Sent Events', 'OpenRouter', 'RunPod TTS'],
    stack: ['Python 3.12', 'FastAPI', 'SQLModel/SQLite', 'Jinja2', 'vanilla JS (PWA)', 'Server-Sent Events', 'OpenRouter (LLM)', 'Kokoro and Chatterbox TTS on RunPod Serverless', 'NumPy/soundfile/ffmpeg', 'Docker Compose', 'Caddy', 'Hetzner', 'GitHub Actions', 'pytest', 'Playwright', 'pip-audit', 'gitleaks', 'Sentry SDK', 'Prometheus'],
    problem: [
      'Audio fiction is either mass-market or expensive to make. Nobody writes a story for one listener, to that listener’s taste, at the length they have time for.',
      'Generic LLM output doesn’t solve this by itself. A usable product needs prose that follows the listener’s constraints, narration that holds up for 5 to 60 minutes, live feedback while that happens, and a pricing model that stays profitable when one request can cost 10x more than another.',
    ],
    built: {
      intro: 'An in-progress startup I build and run independently. The product is production-ready and deployed, but not yet officially launched. A full-stack product, end to end:',
      items: [
        { lead: 'Preference-driven generation.', text: 'Saved preferences plus an optional one-line request are compiled into a constrained prompt that feeds a multi-pass LLM pipeline: draft, then editor, then title.' },
        { lead: 'Live progress over SSE.', text: 'The UI’s progress ring and bar are driven by server-sent events published from the generation worker, for both writing and narration.' },
        { lead: 'Chunked, retried narration.', text: 'Text-to-speech runs on serverless GPU workers. Stories are chunked to stay under the platform’s response-size ceiling, each chunk is retried on its own, and the chunks are stitched back in order. Chunk boundaries double as read-along timing anchors.' },
        { lead: 'A credit model derived from per-story cost.', text: 'It’s priced so a credit costs roughly the same to serve whichever path a story takes.' },
        { lead: 'Production hardening.', text: 'CSRF protection, a strict CSP, rate limits, account export and deletion, data retention jobs, error tracking, metrics, CI security scanning, and a guarded deploy pipeline.' },
      ],
    },
    metrics: [
      { value: '471', label: 'automated tests', note: 'all passing on an isolated copy' },
      { value: '4', label: 'CI jobs on every push', note: 'tests · Playwright · pip-audit · gitleaks' },
      { value: '~15–20s', label: 'to draft, edit and title', note: 'a 5-minute story, two live runs' },
      { value: '59', label: 'commits in about 6 weeks' },
    ],
    diagram: {
      nodes: [
        { id: 'browser', label: 'Browser', sub: 'PWA · vanilla JS', col: 0, row: 1 },
        { id: 'web', label: 'FastAPI app', sub: 'Jinja2 · SQLModel', col: 1, row: 1 },
        { id: 'worker', label: 'Generation worker', sub: 'draft → edit → title', col: 2, row: 1 },
        { id: 'llm', label: 'OpenRouter', sub: 'streaming LLM', col: 2, row: 0 },
        { id: 'bus', label: 'Event bus', sub: 'SSE progress', col: 2, row: 2 },
        { id: 'tts', label: 'RunPod TTS', sub: 'Kokoro · Chatterbox', col: 3, row: 1 },
        { id: 'store', label: 'Storage', sub: 'SQLite · WAV/MP3', col: 4, row: 1 },
      ],
      edges: [['browser', 'web'], ['web', 'worker'], ['worker', 'llm'], ['worker', 'bus'], ['bus', 'browser', 'ps'], ['worker', 'tts'], ['tts', 'store']],
      main: ['browser', 'web', 'worker', 'tts', 'store'],
      caption: 'One story: the server returns 202 and starts a worker; the draft streams from the LLM, passes an editor and a title pass, then is narrated in retried chunks. Every step publishes progress to the browser over Server-Sent Events.',
    },
    disclosure: [
      'Everything in the video is real: a real account, real generation through the LLM pipeline, real SSE progress, and real synthesized narration. Waiting time is trimmed.',
      'The demo ran Kokoro on a local CPU container instead of the GPU endpoint; everything else is the same code path. This video has narration audio; it plays only when you press play.',
    ],
    media: { kind: 'video', duration: hush.duration, label: 'Hush walkthrough: setting preferences, live story generation over SSE, narrated playback, and credit-based pricing', posterAlt: hush.alt.poster },
    screenshots: shots('hush', hush as Manifest),
  },
  {
    slug: 'golf',
    title: 'Golf Event Planner',
    tagline: 'AI-assisted tournament planning',
    kicker: 'SE4471 · Team of 3',
    pitch:
      'An AI-assisted planner that takes a golf tournament from a chat conversation to a validated tee sheet, generated player documents and automated emails.',
    chips: ['React', 'FastAPI', 'MongoDB', 'Claude + MCP'],
    stack: ['React 18', 'Vite', 'dnd-kit', 'FastAPI', 'Python 3.12', 'MongoDB (Motor)', 'JWT / bcrypt', 'Claude via LangChain (structured output)', 'MCP (Python SDK)', 'sentence-transformers (MiniLM)', 'fpdf2', 'SMTP', 'Docker (multi-stage)', 'Docker Compose', 'Nginx', 'Certbot'],
    problem: [
      'Organizing a charity or club golf tournament is mostly paperwork: collecting event details, building a tee sheet, pairing teams without breaking them up, writing a player guide, checking the weather, and emailing everyone the same information more than once.',
      'It usually lives in spreadsheets and copy-pasted emails, and every change means redoing the documents and resending them.',
    ],
    built: {
      intro: 'A full-stack web app built by a team of 3 for SE4471. An organizer describes the event in a chat; a Claude-powered agent turns it into a structured tournament plan, grounded in a small knowledge base and live weather data. My work covered:',
      items: [
        { lead: 'Document generation.', text: 'A deterministic generator turns the tournament plan into the tee-time schedule, event brochure, player invitation, Player Information Guide, Food & Beverage summary and Club Operations Sheet, plus printable golf-cart placards as a PDF (fpdf2).' },
        { lead: 'Email.', text: 'An async SMTP service sends multipart HTML and plain-text email: invitations with a registration link, the full tee sheet as an HTML table, the player guide, the caterer summary and the club operations sheet. 7 automated email flows in total.' },
        { lead: 'Authentication.', text: 'JWT sessions (python-jose) with bcrypt-hashed passwords, and per-account tournament ownership.' },
        { lead: 'The database layer.', text: 'Async MongoDB access through Motor: users, tournaments and registrations, with unique indexes, a public registration flow that fills tee-time slots, and server-side schedule validation.' },
        { lead: 'Containerized deployment.', text: 'Multi-stage Docker images, Docker Compose, and an Nginx reverse proxy with Certbot TLS in production.' },
        { lead: 'Much of the chatbot.', text: 'The Claude agent workflow and my own MCP weather server.' },
      ],
    },
    metrics: [
      { value: '7', label: 'automated email flows', note: 'HTML + plain-text multipart' },
      { value: '10', label: 'document generators', note: 'including a cart-placard PDF' },
      { value: '27', label: 'API endpoints', note: 'backed by 3 MongoDB collections' },
      { value: '388', label: 'RAG chunks', note: '11 documents · plus 4 MCP tools' },
    ],
    diagram: {
      nodes: [
        { id: 'spa', label: 'React SPA', sub: 'Nginx · dnd-kit', col: 0, row: 1 },
        { id: 'api', label: 'FastAPI', sub: '27 endpoints', col: 1, row: 1 },
        { id: 'agent', label: 'Claude agent', sub: 'analyze → validate', col: 2, row: 1 },
        { id: 'rag', label: 'RAG retriever', sub: '388 chunks · MiniLM', col: 2, row: 0 },
        { id: 'mcp', label: 'MCP weather server', sub: '4 tools', col: 3, row: 1, tone: 'mine' },
        { id: 'wx', label: 'Weather APIs', sub: '4 public services', col: 4, row: 1 },
        { id: 'mongo', label: 'MongoDB', sub: '3 collections', col: 0, row: 2, tone: 'mine' },
        { id: 'docs', label: 'Docs + email', sub: '10 generators · SMTP', col: 2, row: 2, tone: 'mine' },
      ],
      edges: [['spa', 'api'], ['api', 'agent'], ['agent', 'rag'], ['agent', 'mcp'], ['mcp', 'wx'], ['api', 'mongo', 'sp'], ['api', 'docs', 'sp']],
      main: ['spa', 'api', 'agent', 'mcp', 'wx'],
      caption: 'Planning: each chat turn retrieves from the RAG corpus, analyzes, optionally calls my MCP weather server, validates in Python and finalizes a reply and updated plan. Documents and email are generated deterministically from the saved plan.',
    },
    disclosure: [
      'The walkthrough runs the real app locally in Docker with fictional data: the “Maple Ridge Charity Classic”, 48 invented golfers, and one more who signs up on camera from the invitation email. Email goes to a local Mailpit inbox.',
      'All chat answers are unedited, live runs of the app’s default model, Claude Sonnet 4.6.',
    ],
    media: { kind: 'video', duration: golf.duration, label: 'Golf Event Planner walkthrough: AI-assisted tournament planning', posterAlt: golf.alt.poster },
    screenshots: shots('golf', golf as Manifest),
  },
  {
    slug: 'assessly',
    title: 'Assessly',
    tagline: 'AI mock interviews with a realtime talking avatar',
    kicker: 'SE\u00a04450 capstone · Team of 4',
    pitch: 'An AI mock-interview platform with a realtime talking avatar, built by a 4-person Scrum team for the SE\u00a04450 capstone.',
    chips: ['React + TypeScript', 'Node/Express', 'Azure OpenAI Realtime', 'WebRTC'],
    stack: ['React', 'TypeScript', 'Node.js', 'Express', 'WebSockets', 'PostgreSQL', 'Azure OpenAI Realtime', 'Whisper', 'Azure TTS Avatar (WebRTC)', 'Azure Blob Storage', 'Azure App Service', 'Docker'],
    problem: [
      'Interview practice works best when it feels like a real conversation. Assessly lets a candidate hold a spoken mock interview with a realtime talking avatar, then review a generated feedback document afterward.',
    ],
    built: {
      intro: 'Built in a 4-person Scrum team for the SE\u00a04450 capstone. My work covered:',
      items: [
        { lead: 'Accounts.', text: 'Email activation and password reset.' },
        { lead: 'Résumé upload.', text: 'Résumé upload to Azure Blob Storage.' },
        { lead: 'Deployment.', text: 'Dockerfiles and the deployment to Azure App Service.' },
        { lead: 'The avatar.', text: 'Integrating the Azure TTS Avatar over WebRTC, and the toggle between the avatar and audio-only modes.' },
        { lead: 'Feedback.', text: 'Feedback document generation.' },
        { lead: 'Multiple interviews.', text: 'Multi-interview support.' },
      ],
    },
    metrics: [
      { value: '4', label: 'person Scrum team' },
      { value: 'SE\u00a04450', label: 'capstone project' },
      { value: '6', label: 'areas I owned', note: 'listed below' },
    ],
    diagram: {
      nodes: [
        { id: 'client', label: 'React client', sub: 'TypeScript', col: 0, row: 1 },
        { id: 'server', label: 'Node/Express', sub: 'REST · WebSockets', col: 1, row: 1 },
        { id: 'rt', label: 'Azure OpenAI', sub: 'Realtime · Whisper', col: 2, row: 1 },
        { id: 'avatar', label: 'TTS Avatar', sub: 'Azure · WebRTC', col: 1, row: 0, tone: 'mine' },
        { id: 'pg', label: 'PostgreSQL', sub: 'users · interviews', col: 2, row: 2 },
        { id: 'blob', label: 'Blob Storage', sub: 'résumé uploads', col: 1, row: 2, tone: 'mine' },
      ],
      edges: [['client', 'server'], ['server', 'rt'], ['client', 'avatar'], ['server', 'pg'], ['server', 'blob']],
      main: ['client', 'server', 'rt'],
      caption: 'The React client talks to the Node/Express server over REST and WebSockets; the server drives the Azure OpenAI Realtime voice pipeline, and the talking avatar streams over WebRTC. Deployed with Docker on Azure App Service.',
    },
    disclosure: ['The video is hosted on YouTube and loads only when you press play (via youtube-nocookie.com).'],
    media: { kind: 'youtube', id: 'fwXobqQA5SY', posterAlt: 'Assessly by AIon title card on a blue background.' },
    screenshots: [],
  },
  {
    slug: 'face-detector',
    title: 'AI-Generated Face Detector',
    tagline: 'Deep learning vs classical baselines',
    kicker: 'DS\u00a03000 · Team of 4',
    pitch:
      'A classifier that tells real face photos from AI-generated ones, pitting transfer-learned EfficientNet-B0 against classical pixel-based baselines, with a Flask dashboard for training, analysis and inference.',
    chips: ['PyTorch', 'EfficientNet-B0', 'scikit-learn', 'Flask'],
    stack: ['Python', 'PyTorch', 'torchvision (EfficientNet-B0)', 'scikit-learn', 'Flask', 'NumPy', 'Pillow', 'matplotlib', 'SLURM', 'NVIDIA H100'],
    problem: [
      'AI-generated faces are now realistic enough to fool people at a glance. They turn up in fake profiles, scams and misinformation.',
      'The question for this project was how well a model can separate real photos from generated ones, and how much deep learning actually buys over simple classical methods working on raw pixels.',
    ],
    built: {
      intro: 'A DS\u00a03000 final project built by a team of 4, training and comparing deep and classical classifiers on a 230,335-image real-vs-fake face dataset. My work covered:',
      items: [
        { lead: 'The Flask dashboard and REST API.', text: 'A single-page UI to choose a model, set samples per class, epochs and batch size, and run training locally or on the cluster, with live epoch progress, test metrics, a classification report and a confusion matrix.' },
        { lead: 'The first end-to-end PyTorch pipeline.', text: '224×224 preprocessing with ImageNet normalization and light augmentation, EfficientNet-B0 transfer learning with a single-logit head, mixed-precision GPU training, per-epoch validation AUC with best-checkpoint saving, and test-set evaluation.' },
        { lead: 'The scikit-learn baselines.', text: 'Logistic regression, SVM, random forest (100 trees) and KNN (k = 5), trained on 64×64 flattened pixel vectors (12,288 features).' },
        { lead: 'The EDA module.', text: 'Class balance per split, image counts per data set, and a sample grid of real and fake faces, all generated from the dataset on demand.' },
        { lead: 'The SLURM scripts.', text: 'Batch jobs for deep-learning training on an H100 GPU and for the scikit-learn baselines on the cluster.' },
      ],
      outro: 'My teammates built the image distortion generator (JPEG compression and moiré), the additional deep architectures, and the benchmark of pretrained and commercial API detectors.',
    },
    metrics: [
      { value: '92.5%', label: 'test accuracy', note: 'EfficientNet-B0 · 19,329 / 20,905' },
      { value: '0.986', label: 'test AUC', note: 'validation AUC peaked at 0.9975' },
      { value: '+26.6', label: 'points over the best pixel baseline', note: 'random forest: 65.9%' },
      { value: '230,335', label: 'images across four data sets' },
    ],
    diagram: {
      nodes: [
        { id: 'dash', label: 'Flask dashboard', sub: 'JSON API', col: 0, row: 1 },
        { id: 'local', label: 'Background thread', sub: 'local training', col: 1, row: 0 },
        { id: 'slurm', label: 'SLURM job', sub: 'H100 cluster', col: 1, row: 2 },
        { id: 'train', label: 'Model training', sub: 'PyTorch · sklearn', col: 2, row: 1 },
        { id: 'eval', label: 'Metrics + figures', sub: 'test metrics · plots', col: 3, row: 1 },
        { id: 'predict', label: 'predict.py', sub: 'one-image inference', col: 3, row: 2 },
      ],
      edges: [['dash', 'local'], ['dash', 'slurm'], ['local', 'train'], ['slurm', 'train'], ['train', 'eval'], ['train', 'predict']],
      main: ['dash', 'local', 'train', 'eval'],
      caption: 'Training: the dashboard posts to /api/train, which runs PyTorch or scikit-learn in a background thread or submits an sbatch job; per-epoch progress is polled from /api/status, then test metrics and figures return to the dashboard.',
    },
    disclosure: [
      'The walkthrough runs the real Flask app locally. Its interface was restyled for the video; no features were added and no numbers were changed. The EDA view is live output over the full dataset.',
      'The two predictions are real predict.py runs on the CPU using a local checkpoint (1 epoch, validation AUC 0.925), because the H100 checkpoint wasn’t available. The 92.5% vs 65.9% comparison comes from the team’s saved H100 result figures.',
    ],
    media: { kind: 'video', duration: face.duration, label: 'AI-Generated Face Detector walkthrough: deep learning vs classical baselines', posterAlt: face.alt.poster },
    screenshots: shots('face-detector', face as Manifest),
  },
];

export const bySlug = (slug: string) => projects.find((p) => p.slug === slug)!;

export function neighbours(slug: string) {
  const i = projects.findIndex((p) => p.slug === slug);
  return {
    prev: projects[(i - 1 + projects.length) % projects.length],
    next: projects[(i + 1) % projects.length],
  };
}

export function formatDuration(seconds: number) {
  const t = Math.round(seconds);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
