<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Signed-in content lives under the managed `_authenticated` layout; the public index owns onboarding so public SSR never reads private records.
- Workspace reads use authenticated server functions and a month-keyed Query cache; browser writes remain RLS-scoped.
- Admin authority comes from protected mess_user_roles, not member labels or browser storage.
