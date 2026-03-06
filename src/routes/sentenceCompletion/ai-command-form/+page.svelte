<script>
    import {onMount} from 'svelte';
    import {browser} from '$app/environment';
    import {copyToClipboard} from '$lib/utils/clipboard.js';

    const STORAGE_KEY_PR = 'ai-command-form-pr';
    const STORAGE_KEY_REVIEW = 'ai-command-form-review';

    // --- PR 작성 요청 ---
    let prMdFile = $state('');
    let prProject = $state('');
    let prBranch = $state('');

    let prResult = $derived(
        `# PR 작성\n- 참고md: ${prMdFile}\n- 프로젝트: ${prProject}\n- 브랜치: ${prBranch}\nmd파일 참고해서 해당 프로젝트의 브랜치로 커밋내용에대해 PR 작성해줘`
    );

    function resetPr() {
        prMdFile = '';
        prProject = '';
        prBranch = '';
    }

    // --- PR 리뷰 작성 요청 ---
    let reviewMdFile = $state('');
    let reviewPrUrl = $state('');
    let reviewToken = $state('');

    let reviewResult = $derived(
        `# PR 리뷰 작성\n- 참고md: ${reviewMdFile}\n- PR URL: ${reviewPrUrl}\n- Public Access Token: ${reviewToken}\nmd파일 참고, Public Access Token을 사용해서 PR 리뷰 작성해줘\n인라인 리뷰는 해당라인에 Add a comment on this line을 통해 작성해야해`
    );

    function resetReview() {
        reviewMdFile = '';
        reviewPrUrl = '';
        reviewToken = '';
    }

    // --- localStorage ---
    let initialized = $state(false);

    $effect(() => {
        if (browser && initialized) {
            localStorage.setItem(STORAGE_KEY_PR, JSON.stringify({prMdFile, prProject, prBranch}));
        }
    });

    $effect(() => {
        if (browser && initialized) {
            localStorage.setItem(STORAGE_KEY_REVIEW, JSON.stringify({reviewMdFile, reviewPrUrl, reviewToken}));
        }
    });

    onMount(() => {
        try {
            const savedPr = localStorage.getItem(STORAGE_KEY_PR);
            if (savedPr) {
                const d = JSON.parse(savedPr);
                prMdFile = d.prMdFile ?? '';
                prProject = d.prProject ?? '';
                prBranch = d.prBranch ?? '';
            }
            const savedReview = localStorage.getItem(STORAGE_KEY_REVIEW);
            if (savedReview) {
                const d = JSON.parse(savedReview);
                reviewMdFile = d.reviewMdFile ?? '';
                reviewPrUrl = d.reviewPrUrl ?? '';
                reviewToken = d.reviewToken ?? '';
            }
        } catch {}
        initialized = true;
    });
</script>

<div class="container mx-auto p-4">
    <div class="mb-8 rounded-xl bg-neutral py-5 text-center shadow">
        <h1 class="text-2xl font-bold text-neutral-content">업무 AI 명령 양식</h1>
    </div>
    <div class="space-y-12">
    <!-- PR 작성 요청 -->
    <div>
        <h1 class="mb-4 text-2xl font-bold">PR 작성 요청</h1>
        <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div class="card bg-base-100 shadow-xl">
                <div class="card-body">
                    <div class="mb-2 flex items-center justify-between">
                        <h2 class="card-title">입력</h2>
                        <button class="btn btn-xs btn-error" onclick={resetPr}>초기화</button>
                    </div>
                    <div class="form-control w-full">
                        <label class="label" for="pr-md-file">
                            <span class="label-text">md파일</span>
                        </label>
                        <input
                            id="pr-md-file"
                            type="text"
                            class="input-bordered input w-full"
                            placeholder="/bizppurio/bizweb/.github/instructions/git-push-and-pr.instructions.md"
                            bind:value={prMdFile}
                        />
                    </div>
                    <div class="form-control w-full">
                        <label class="label" for="pr-project">
                            <span class="label-text">프로젝트</span>
                        </label>
                        <input
                            id="pr-project"
                            type="text"
                            class="input-bordered input w-full"
                            placeholder="bizweb"
                            bind:value={prProject}
                        />
                    </div>
                    <div class="form-control w-full">
                        <label class="label" for="pr-branch">
                            <span class="label-text">브랜치</span>
                        </label>
                        <input
                            id="pr-branch"
                            type="text"
                            class="input-bordered input w-full"
                            placeholder="feature/NBIZPPURIO-3178"
                            bind:value={prBranch}
                        />
                    </div>
                </div>
            </div>
            <div class="card bg-base-200 shadow-xl">
                <div class="card-body">
                    <div class="mb-2 flex items-center justify-between">
                        <h2 class="card-title">결과</h2>
                        <button class="btn btn-sm btn-primary" onclick={() => copyToClipboard(prResult)}>
                            복사하기
                        </button>
                    </div>
                    <div class="form-control">
                        <textarea
                            class="textarea-bordered textarea h-48 w-full"
                            readonly
                            value={prResult}
                        ></textarea>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- PR 리뷰 작성 요청 -->
    <div>
        <h1 class="mb-4 text-2xl font-bold">PR 리뷰 작성 요청</h1>
        <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div class="card bg-base-100 shadow-xl">
                <div class="card-body">
                    <div class="mb-2 flex items-center justify-between">
                        <h2 class="card-title">입력</h2>
                        <button class="btn btn-xs btn-error" onclick={resetReview}>초기화</button>
                    </div>
                    <div class="form-control w-full">
                        <label class="label" for="review-md-file">
                            <span class="label-text">md파일</span>
                        </label>
                        <input
                            id="review-md-file"
                            type="text"
                            class="input-bordered input w-full"
                            placeholder="/bizppurio/bizweb/.github/instructions/git-push-and-pr.instructions.md"
                            bind:value={reviewMdFile}
                        />
                    </div>
                    <div class="form-control w-full">
                        <label class="label" for="review-pr-url">
                            <span class="label-text">PR URL</span>
                        </label>
                        <input
                            id="review-pr-url"
                            type="text"
                            class="input-bordered input w-full"
                            placeholder="https://repo.daou.co.kr/projects/BIZ/repos/bizweb/pull-requests/1304/overview"
                            bind:value={reviewPrUrl}
                        />
                    </div>
                    <div class="form-control w-full">
                        <label class="label" for="review-token">
                            <span class="label-text">Public Access Token</span>
                        </label>
                        <input
                            id="review-token"
                            type="password"
                            class="input-bordered input w-full"
                            placeholder="token"
                            bind:value={reviewToken}
                        />
                    </div>
                </div>
            </div>
            <div class="card bg-base-200 shadow-xl">
                <div class="card-body">
                    <div class="mb-2 flex items-center justify-between">
                        <h2 class="card-title">결과</h2>
                        <button class="btn btn-sm btn-primary" onclick={() => copyToClipboard(reviewResult)}>
                            복사하기
                        </button>
                    </div>
                    <div class="form-control">
                        <textarea
                            class="textarea-bordered textarea h-48 w-full"
                            readonly
                            value={reviewResult}
                        ></textarea>
                    </div>
                </div>
            </div>
        </div>
    </div>
    </div>
</div>
