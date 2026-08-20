"use client";

import React from "react";

interface SopViewerProps {
  content: string;
}

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
      <div
        className="text-gray-300 leading-relaxed whitespace-pre-wrap"
        dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, "<br />") }}
      />
    </div>
  );
}

export default SopViewerInner;
export { SopViewerInner as SopViewer };
