// Shared spacing tokens for blog surfaces.
// Improved for proper editorial rhythm (no generic stack spacing).

export const blogSpacing = {
  /* ===== Page layout ===== */
  pageTop: "pt-[var(--blog-nav-offset-mobile)] md:pt-[var(--blog-nav-offset-desktop)]",
  pageBottom: "pb-[var(--blog-page-bottom-mobile)] md:pb-[var(--blog-page-bottom-desktop)]",
  sectionTop: "pt-[var(--blog-related-grid-top)] md:pt-[var(--blog-related-top)]",

  shellGap: "gap-[var(--blog-shell-gap-mobile)] lg:gap-[var(--blog-shell-gap-desktop)]",
  stickyTop: "top-[var(--blog-sticky-top)]",

  /* ===== Header ===== */
  headerTopRowGap: "gap-[var(--blog-header-row-gap)]",
  inlineIconGap: "gap-[var(--blog-inline-icon-gap)]",

  headerMetaTop: "mt-[var(--blog-meta-top)]",
  headerMetaGap: "gap-[var(--blog-meta-inline-gap)]",
  headerMetaIconGap: "gap-[var(--blog-meta-icon-gap)]",

  titleTop: "mt-[var(--blog-title-top)]",
  excerptTop: "mt-[var(--blog-excerpt-top)]",
  authorTop: "mt-[var(--blog-author-top)]",
  authorInlineGap: "gap-[var(--blog-author-inline-gap)]",

  /* ===== Mobile TOC ===== */
  mobileTocTop: "mt-[var(--blog-mobile-toc-top)]",
  mobileTocPanelPad: "p-[var(--blog-mobile-toc-panel-padding)]",
  mobileTocExpandedTop: "mt-[var(--blog-mobile-toc-expanded-top)]",

  /* ===== Media & layout ===== */
  imageTop: "mt-[var(--blog-image-top)]",
  contentTop: "mt-[var(--blog-content-top)]",

  bottomActionsTop: "mt-[var(--blog-bottom-actions-top)]",
  bottomActionsPadTop: "pt-[var(--blog-bottom-actions-padding-top)]",

  /* ===== Article body (FIXED) ===== */

  // ❌ removed bodyStack (was causing bad spacing)
  bodyLineHeight: "leading-[var(--blog-body-line-height)]",

  // headings should use margin, not padding
  headingScrollMargin: "scroll-mt-[var(--blog-heading-scroll-offset)]",
  h2Top: "mt-[var(--blog-h2-top)]",
  h3Top: "mt-[var(--blog-h3-top)]",

  // NEW: per-element spacing
  paragraphTop: "mt-[var(--blog-paragraph-gap)]",
  listTop: "mt-[var(--blog-list-top)]",
  listGap: "space-y-[var(--blog-list-gap)]",
  calloutTop: "mt-[var(--blog-callout-top)]",

  calloutPadding: "p-[var(--blog-callout-padding)]",
  calloutBodyTop: "mt-[var(--blog-callout-body-top)]",

  /* ===== TOC ===== */
  tocLabelGap: "gap-[var(--blog-toc-label-gap)]",
  tocListTop: "mt-[var(--blog-toc-list-top)]",
  tocListGap: "space-y-[var(--blog-toc-item-gap)]",
  tocListPad: "pl-[var(--blog-toc-list-padding)]",
  tocItemPadX: "px-[var(--blog-toc-item-px)]",
  tocItemPadY: "py-[var(--blog-toc-item-py)]",
  tocItemLevel3Pad: "pl-[var(--blog-toc-level3-padding)]",

  /* ===== Actions ===== */
  actionGroupGap: "gap-[var(--blog-action-group-gap)]",
  actionRowGap: "gap-[var(--blog-action-row-gap)]",

  /* ===== Related ===== */
  relatedTop: "mt-[var(--blog-related-top)]",
  relatedHeaderGap: "gap-[var(--blog-related-header-gap)]",
  relatedTitleTop: "mt-[var(--blog-related-title-top)]",
  relatedEmptyBodyTop: "mt-[var(--blog-related-empty-body-top)]",

  relatedCardGap: "gap-[var(--blog-related-card-gap)]",
  relatedGridGapY: "gap-y-[var(--blog-related-grid-gap-y)]",
  relatedGridGapX: "gap-x-[var(--blog-related-grid-gap-x)]",
  relatedGridTop: "mt-[var(--blog-related-grid-top)]",

  /* ===== CTA ===== */
  ctaTop: "mt-[var(--blog-cta-top)]",

  /* ===== Not found ===== */
  notFoundTitleTop: "mt-[var(--blog-not-found-title-top)]",
  notFoundBodyTop: "mt-[var(--blog-not-found-body-top)]",
  notFoundCtaTop: "mt-[var(--blog-not-found-cta-top)]",
} as const

export const BLOG_SCROLL_OFFSET_PX = 112