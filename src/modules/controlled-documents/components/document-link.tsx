"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
// Reload the documentary snapshot on navigation, including after server actions.
export function DocumentLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & {
    href: string;
}) {
    return <Link {...props} href={href} prefetch={false} onNavigate={event => {
            event.preventDefault();
            window.location.assign(href);
        }}/>;
}
