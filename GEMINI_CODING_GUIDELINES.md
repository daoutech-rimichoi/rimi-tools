# Gemini 코딩 가이드라인

이 문서는 Gemini CLI 에이전트가 프로젝트 작업을 수행할 때 참고해야 할 코딩 규칙 및 지침을 담고 있습니다.

## Svelte {#each} 블록 키 요구 사항

**규칙:** `{#each}` 블록을 사용할 때는 항상 고유한 `key`를 지정해야 합니다.

**ESLint 경고:** `ESLint: Each block should have a key (svelte/require-each-key)`

**설명:**
Svelte의 `{#each}` 블록은 목록의 항목을 렌더링할 때 각 항목에 고유한 키를 제공하는 것이 좋습니다. 키는 Svelte가 목록의 항목을 효율적으로 식별하고, 항목이 추가, 제거 또는 재정렬될 때 DOM을 최소한으로 조작하여 성능을 최적화하는 데 도움이 됩니다. 키가 없으면 Svelte는 항목의 순서에 따라 DOM을 업데이트하므로, 목록이 변경될 때 예상치 못한 동작이나 성능 저하가 발생할 수 있습니다.

**해결 방법:**
`{#each expression as item (key)}` 형식으로 `key`를 추가합니다. `key`는 각 `item`을 고유하게 식별할 수 있는 값이어야 합니다.

**예시:**

```svelte
<!-- 잘못된 예시 (키 없음) -->
{#each items as item}
	<p>{item.name}</p>
{/each}

<!-- 올바른 예시 (item.id를 키로 사용) -->
{#each items as item (item.id)}
	<p>{item.name}</p>
{/each}

<!-- 문자열 배열의 경우, item 자체를 키로 사용 -->
{#each strings as str (str)}
	<p>{str}</p>
{/each}
```

**향후 작업 시 참고:**
새로운 `{#each}` 블록을 작성하거나 기존 블록을 수정할 때는 항상 이 규칙을 준수하여 `key`를 명시적으로 지정해야 합니다.
