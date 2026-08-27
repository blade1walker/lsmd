"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SopViewerProps {
  content: string;
}

/**
 * The editor has always advertised Markdown, but this rendered it by swapping
 * newlines for <br> and injecting the result with dangerouslySetInnerHTML —
 * headings and lists came out as literal `#` and `-`, and any HTML in the
 * content was executed. react-markdown escapes by default.
 */
function SopViewerInner({ content }: SopViewerProps) {
  if (!content) {
    return (
      <div className="text-center py-16">
        <div className="text-gray-500 text-lg">No SOP content available</div>
      </div>
    );
  }

  return (
    <div className="prose prose-invert prose-red max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export default SopViewerInner;
export { SopViewerInner as SopViewer };
