// Globals set by each page before this script loads:
//   __BASE_PATH__   - relative path to site root ("." or "..")
//   __PAGE_ID__     - page identifier (e.g. "chapter-01/PART0.md" or "_overview/FILE.md" or "")
//   __PAGE_CONTENT__ - markdown content string (empty string for welcome/index page)
//   __STRUCTURE__   - course structure object (embedded in every page)

var basePath = (typeof __BASE_PATH__ !== 'undefined') ? __BASE_PATH__ : '.';
var currentPageId = (typeof __PAGE_ID__ !== 'undefined') ? __PAGE_ID__ : '';
var currentContent = (typeof __PAGE_CONTENT__ !== 'undefined') ? __PAGE_CONTENT__ : '';

var courseData = null;
var allParts = [];
var readParts = new Set(JSON.parse(localStorage.getItem('readParts') || '[]'));
var collapseState = JSON.parse(localStorage.getItem('collapseState') || '{}');
var sections = [];
var currentSlideIdx = 0;

// Restore preferences
restoreDarkMode();
restoreFontSize();

marked.setOptions({ breaks: false, gfm: true });

function init() {
  courseData = (typeof __STRUCTURE__ !== 'undefined') ? __STRUCTURE__ : null;
  if (!courseData) {
    document.getElementById('sidebarContent').innerHTML =
      '<div class="loading"><div class="loading-text">Failed to load navigation</div></div>';
    return;
  }

  // Auto-expand the active part whenever a page loads
  if (currentPageId) {
    collapseState[currentPageId] = true;
    saveCollapseState();
  }

  buildSidebar();

  if (currentContent) {
    renderSections(currentContent);

    readParts.add(currentPageId);
    localStorage.setItem('readParts', JSON.stringify([...readParts]));
    localStorage.setItem('lastPage', currentPageId);
    buildSidebar();

    // Update header title
    var part = allParts.find(function(p) { return p.fullId === currentPageId; });
    if (part) {
      document.getElementById('headerPart').textContent = simplifyTitle(part.part.title);
    } else if (currentPageId.indexOf('_overview/') === 0) {
      var ovFilename = currentPageId.replace('_overview/', '');
      var ov = courseData.overview ? courseData.overview.find(function(o) { return o.filename === ovFilename; }) : null;
      if (ov) {
        document.getElementById('headerPart').textContent = ov.title;
      }
    }
  } else {
    // Welcome page - show resume button if user has visited before
    var lastPage = localStorage.getItem('lastPage');
    if (lastPage) {
      var part = allParts.find(function(p) { return p.fullId === lastPage; });
      if (part) {
        var btn = document.getElementById('resumeBtn');
        if (btn) {
          btn.href = part.url;
          btn.textContent = 'Continue: ' + simplifyTitle(part.part.title);
          btn.style.display = '';
        }
      }
    }
  }
}

function buildSidebar() {
  var container = document.getElementById('sidebarContent');
  var html = '';
  allParts = [];

  // First pass: always populate allParts for prev/next navigation
  courseData.chapters.forEach(function(chapter) {
    chapter.parts.forEach(function(part) {
      var partId = chapter.id + '/' + part.filename;
      var url = basePath + '/' + chapter.dir + '/' + part.filename.replace('.md', '.html');
      allParts.push({ chapterId: chapter.id, part: part, fullId: partId, url: url });
    });
  });

  // Overview section
  if (courseData.overview && courseData.overview.length > 0) {
    var ovOpen = collapseState['_overview'] !== false;
    html += '<div class="sidebar-group-header" id="sidebarOverviewHdr" onclick="toggleGroup(\'_overview\')">';
    html += '<span class="sidebar-caret' + (ovOpen ? ' open' : '') + '">&#9656;</span>';
    html += '<span class="sidebar-group-icon">&#9776;</span>';
    html += '<span>Course Overview</span>';
    html += '</div>';
    if (ovOpen) {
      courseData.overview.forEach(function(ov) {
        var ovId = '_overview/' + ov.filename;
        var url = basePath + '/' + ov.filename.replace('.md', '.html');
        var isRead = readParts.has(ovId);
        var isActive = currentPageId === ovId;
        var cls = 'sidebar-item' + (isRead ? ' read' : '') + (isActive ? ' active' : '');
        html += '<a class="' + cls + '" href="' + url + '">';
        html += '<span class="sidebar-item-icon">' + (isRead ? '&#10004;' : '&#128218;') + '</span>';
        html += '<span>' + escapeHtml(ov.title) + '</span>';
        html += '</a>';
      });
    }
  }

  // Chapters
  courseData.chapters.forEach(function(chapter) {
    var chOpen = collapseState[chapter.id] !== undefined ? collapseState[chapter.id] : true;

    html += '<div class="sidebar-group-header" onclick="toggleGroup(\'' + chapter.id + '\')">';
    html += '<span class="sidebar-caret' + (chOpen ? ' open' : '') + '">&#9656;</span>';
    html += '<span class="sidebar-group-icon">&#9670;</span>';
    html += '<span>' + escapeHtml(chapter.title) + '</span>';
    html += '</div>';

    if (chOpen) {
      chapter.parts.forEach(function(part, idx) {
        var partId = chapter.id + '/' + part.filename;
        var url = basePath + '/' + chapter.dir + '/' + part.filename.replace('.md', '.html');
        var isRead = readParts.has(partId);
        var isActive = currentPageId === partId;
        var hasSections = isActive && sections.length > 1;
        var partOpen = collapseState[partId] !== undefined ? collapseState[partId] : isActive;

        var iconHtml = '<span class="sidebar-item-icon">' + (isRead ? '&#10004;' : (idx + 1)) + '</span>';

        if (hasSections) {
          var cls = 'sidebar-part-header' + (isActive ? ' active' : '') + (isRead ? ' read' : '');
          html += '<div class="' + cls + '" onclick="togglePart(\'' + partId + '\')">';
          html += iconHtml;
          html += '<span class="sidebar-part-title">' + escapeHtml(simplifyTitle(part.title)) + '</span>';
          html += '<span class="sidebar-caret' + (partOpen ? ' open' : '') + '">&#9656;</span>';
          html += '</div>';
          if (partOpen) {
            html += '<div class="sidebar-part-body">';
            sections.forEach(function(sec, sIdx) {
              var title = getSectionTitle(sec);
              var isActiveSec = sIdx === currentSlideIdx;
              html += '<div class="sidebar-section-item' + (isActiveSec ? ' active' : '') + '" onclick="goToSlide(' + sIdx + ')">';
              html += '<span class="sidebar-section-dot">&#8250;</span>';
              html += '<span>' + escapeHtml(title) + '</span>';
              html += '</div>';
            });
            html += '</div>';
          }
        } else {
          var cls2 = 'sidebar-item' + (isActive ? ' active' : '') + (isRead ? ' read' : '');
          html += '<a class="' + cls2 + '" href="' + url + '">';
          html += iconHtml;
          html += '<span>' + escapeHtml(simplifyTitle(part.title)) + '</span>';
          html += '</a>';
        }
      });
    }
  });

  container.innerHTML = html;

  // Scroll active section into view
  var activeSection = container.querySelector('.sidebar-section-item.active');
  if (activeSection) activeSection.scrollIntoView({ block: 'nearest' });
}

function saveCollapseState() {
  localStorage.setItem('collapseState', JSON.stringify(collapseState));
}

function toggleGroup(key) {
  var currentlyOpen = collapseState[key] !== undefined ? collapseState[key] : true;
  collapseState[key] = !currentlyOpen;
  saveCollapseState();
  buildSidebar();
}

function togglePart(partId) {
  var isActive = partId === currentPageId;
  var currentlyOpen = collapseState[partId] !== undefined ? collapseState[partId] : isActive;
  collapseState[partId] = !currentlyOpen;
  saveCollapseState();
  buildSidebar();
}

function getSectionTitle(sectionMd) {
  var match = sectionMd.match(/^#{1,2}\s+(.+)/m);
  if (match) {
    return match[1].trim().replace(/\*\*/g, '').replace(/`/g, '').replace(/\*/g, '');
  }
  var lines = sectionMd.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line) return line.substring(0, 60);
  }
  return 'Section';
}

function updateSidebarActiveSection(idx) {
  var items = document.querySelectorAll('.sidebar-section-item');
  items.forEach(function(el, i) {
    el.classList.toggle('active', i === idx);
  });
  if (items[idx]) items[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function simplifyTitle(title) {
  return title.replace(/^Chapter\s*\d+,\s*Part\s*\d+:\s*/i, '');
}

function renderSections(md) {
  var lines = md.split('\n');
  sections = [];
  var current = [];

  var inCodeBlock = false;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    // Track fenced code blocks so we don't split on # inside them
    if (line.indexOf(String.fromCharCode(96,96,96)) === 0 || line.match(/^~{3,}/)) {
      inCodeBlock = !inCodeBlock;
    }
    // Split at h1 and h2 headings (# and ##), but not h3+ and not inside code blocks
    if (!inCodeBlock && line.match(/^#{1,2} /) && current.length > 0) {
      sections.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    sections.push(current.join('\n'));
  }

  while (sections.length > 0 && sections[0].trim() === '') {
    sections.shift();
  }

  if (sections.length === 0) {
    sections = [md];
  }

  // Merge any section that starts with an h1 heading (# ) with the next section,
  // so that standalone title slides like "# PART 1:" join with their first content section.
  for (var m = sections.length - 2; m >= 0; m--) {
    if (sections[m].match(/^# [^#]/) && !sections[m].match(/^## /m)) {
      sections[m] = sections[m] + '\n\n' + sections[m + 1];
      sections.splice(m + 1, 1);
    }
  }

  // Also merge section 0 with section 1 if section 0 is short (intro/title metadata),
  // so the title page always has substantial content.
  if (sections.length > 1) {
    var nonBlank = sections[0].split('\n').filter(function(l) { return l.trim() !== ''; }).length;
    if (nonBlank < 12) {
      sections[0] = sections[0] + '\n\n' + sections[1];
      sections.splice(1, 1);
    }
  }

  var container = document.getElementById('sectionsContainer');
  container.innerHTML = '';

  sections.forEach(function(sec, idx) {
    var slide = document.createElement('div');
    slide.className = 'section-slide';
    slide.style.position = 'absolute';
    slide.style.top = '0';
    slide.style.left = '0';
    slide.style.width = '100%';
    slide.style.height = '100%';

    var html = marked.parse(sec);
    html = html.replace(/<pre><code class="language-(\w+)">/g, function(m, lang) {
      return '<pre class="has-lang"><div class="code-lang">' + lang + '</div><button class="code-copy-btn" onclick="copyCode(this)">Copy</button><code class="language-' + lang + '">';
    });
    html = html.replace(/<pre><code>/g, '<pre><button class="code-copy-btn" onclick="copyCode(this)">Copy</button><code class="nohighlight">');

    if (idx === 0) {
      var meta = '';
      var timeMatch = sec.match(/\*\*Time to complete\*\*:\s*(.+)/);
      var prereqMatch = sec.match(/\*\*Prerequisites\*\*:\s*(.+)/);
      var learnMatch = sec.match(/\*\*What you'll learn\*\*:\s*(.+)/);
      if (timeMatch || prereqMatch || learnMatch) {
        meta = '<div class="part-meta">';
        if (timeMatch) meta += '<span class="part-meta-item">' + escapeHtml(timeMatch[1]) + '</span>';
        if (prereqMatch) meta += '<span class="part-meta-item">' + escapeHtml(prereqMatch[1]) + '</span>';
        if (learnMatch) meta += '<span class="part-meta-item">' + escapeHtml(learnMatch[1]) + '</span>';
        meta += '</div>';
      }
      html = html.replace(/<p><strong>Time to complete<\/strong>:[^]*?<\/p>/i, '');
      html = html.replace(/<p><strong>What you'll learn<\/strong>:[^]*?<\/p>/i, '');
      html = html.replace(/^\s*<hr\s*\/?>\s*/i, '');
      html = meta + html;
    }

    slide.innerHTML = '<div class="section-content">' + html + '</div>';
    container.appendChild(slide);
  });

  currentSlideIdx = 0;
  updateSlides();
  buildDots();

  // Ensure all slides start scrolled to top
  container.querySelectorAll('.section-slide').forEach(function(s) { s.scrollTop = 0; });

  container.querySelectorAll('pre code').forEach(function(block) { Prism.highlightElement(block); });

  if (sections.length > 1) {
    document.getElementById('sectionNav').style.display = 'flex';
  }
}

function updateSlides() {
  var slides = document.querySelectorAll('.section-slide');
  slides.forEach(function(slide, idx) {
    if (idx === currentSlideIdx) {
      slide.style.transform = 'translateX(0)';
      slide.style.opacity = '1';
      slide.style.pointerEvents = 'auto';
      slide.style.visibility = 'visible';
    } else if (idx < currentSlideIdx) {
      slide.style.transform = 'translateX(-100%)';
      slide.style.opacity = '0';
      slide.style.pointerEvents = 'none';
      slide.style.visibility = 'hidden';
    } else {
      slide.style.transform = 'translateX(100%)';
      slide.style.opacity = '0';
      slide.style.pointerEvents = 'none';
      slide.style.visibility = 'hidden';
    }
  });

  document.getElementById('sectionIndicator').textContent =
    (currentSlideIdx + 1) + ' / ' + sections.length;

  document.getElementById('prevSection').disabled = currentSlideIdx === 0;
  document.getElementById('nextSection').disabled = currentSlideIdx === sections.length - 1;

  document.querySelectorAll('.section-dot').forEach(function(dot, idx) {
    dot.classList.toggle('active', idx === currentSlideIdx);
  });

  updateSidebarActiveSection(currentSlideIdx);
  updateBreadcrumb();
  closeToc();
  buildToc();
}

function buildDots() {
  var container = document.getElementById('sectionDots');
  if (sections.length <= 1) {
    container.innerHTML = '';
    return;
  }
  var html = '';
  sections.forEach(function(_, idx) {
    html += '<div class="section-dot' + (idx === 0 ? ' active' : '') + '" onclick="goToSlide(' + idx + ')"></div>';
  });
  container.innerHTML = html;
}

function nextSlide() {
  if (currentSlideIdx < sections.length - 1) {
    currentSlideIdx++;
    updateSlides();
    var slides = document.querySelectorAll('.section-slide');
    if (slides[currentSlideIdx]) slides[currentSlideIdx].scrollTop = 0;
  } else {
    // Navigate to next part page
    var idx = allParts.findIndex(function(p) { return p.fullId === currentPageId; });
    if (idx >= 0 && idx < allParts.length - 1) {
      window.location.href = allParts[idx + 1].url;
    }
  }
}

function prevSlide() {
  if (currentSlideIdx > 0) {
    currentSlideIdx--;
    updateSlides();
    var slides = document.querySelectorAll('.section-slide');
    if (slides[currentSlideIdx]) slides[currentSlideIdx].scrollTop = 0;
  } else {
    // Navigate to prev part page
    var idx = allParts.findIndex(function(p) { return p.fullId === currentPageId; });
    if (idx > 0) {
      window.location.href = allParts[idx - 1].url;
    }
  }
}

function goToSlide(idx) {
  currentSlideIdx = idx;
  updateSlides();
  var slides = document.querySelectorAll('.section-slide');
  if (slides[currentSlideIdx]) slides[currentSlideIdx].scrollTop = 0;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

function toggleMobile() {
  document.getElementById('sidebar').classList.toggle('open');
}

// Dark mode
function restoreDarkMode() {
  var dark = localStorage.getItem('darkMode') === '1';
  if (dark) {
    document.documentElement.classList.add('dark');
    var icon = document.getElementById('darkIcon');
    if (icon) icon.innerHTML = '&#9788;';
    var lightTheme = document.querySelector('.prism-theme[data-theme="light"]');
    var darkTheme = document.querySelector('.prism-theme[data-theme="dark"]');
    if (lightTheme) lightTheme.disabled = true;
    if (darkTheme) darkTheme.disabled = false;
  }
}

function toggleDark() {
  var isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark ? '1' : '0');
  var icon = document.getElementById('darkIcon');
  if (icon) icon.innerHTML = isDark ? '&#9788;' : '&#9789;';
  var lightTheme = document.querySelector('.prism-theme[data-theme="light"]');
  var darkTheme = document.querySelector('.prism-theme[data-theme="dark"]');
  if (lightTheme) lightTheme.disabled = isDark;
  if (darkTheme) darkTheme.disabled = !isDark;
}

// Font size
function restoreFontSize() {
  var scale = parseFloat(localStorage.getItem('fontScale') || '1');
  document.documentElement.style.setProperty('--font-scale', scale);
}

function changeFontSize(dir) {
  var scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-scale') || '1');
  scale = Math.round((scale + dir * 0.1) * 10) / 10;
  if (scale < 0.8) scale = 0.8;
  if (scale > 1.4) scale = 1.4;
  document.documentElement.style.setProperty('--font-scale', scale);
  localStorage.setItem('fontScale', scale);
}

function loadFirst() {
  if (allParts.length > 0) {
    window.location.href = allParts[0].url;
  }
}

function escapeHtml(text) {
  var d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function copyCode(btn) {
  var pre = btn.closest('pre');
  var code = pre.querySelector('code');
  var text = code.textContent;

  navigator.clipboard.writeText(text).then(function() {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(function() {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 2000);
  }).catch(function() {
    btn.textContent = 'Failed';
    setTimeout(function() {
      btn.textContent = 'Copy';
    }, 2000);
  });
}

function updateBreadcrumb() {
  var bc = document.getElementById('breadcrumb');
  if (!bc) return;
  var crumbs = [{ label: 'Go Concurrency', current: false }];
  if (currentPageId && courseData) {
    if (currentPageId.indexOf('_overview/') === 0) {
      var ovFilename = currentPageId.replace('_overview/', '');
      var ov = courseData.overview ? courseData.overview.find(function(o) { return o.filename === ovFilename; }) : null;
      if (ov) crumbs.push({ label: ov.title, current: sections.length === 0 });
    } else {
      var chapterId = currentPageId.split('/')[0];
      var chapter = courseData.chapters.find(function(c) { return c.id === chapterId; });
      if (chapter) crumbs.push({ label: chapter.title, current: false });
      var partItem = allParts.find(function(p) { return p.fullId === currentPageId; });
      if (partItem) crumbs.push({ label: simplifyTitle(partItem.part.title), current: sections.length === 0 });
    }
    if (sections.length > 0 && currentSlideIdx < sections.length) {
      crumbs.push({ label: getSectionTitle(sections[currentSlideIdx]), current: true });
    }
  }
  bc.innerHTML = crumbs.map(function(crumb, i) {
    return (i > 0 ? '<span class="breadcrumb-sep">\u203a</span>' : '') +
      '<span class="breadcrumb-item' + (crumb.current ? ' current' : '') + '">' +
      escapeHtml(crumb.label) + '</span>';
  }).join('');
}

function buildToc() {
  var slides = document.querySelectorAll('.section-slide');
  var slide = slides[currentSlideIdx];
  var btn = document.getElementById('tocBtn');
  var container = document.getElementById('tocItems');
  if (!slide || !btn || !container) return;
  var headings = slide.querySelectorAll('h3, h4');
  if (headings.length === 0) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = '';
  var html = '';
  headings.forEach(function(h, i) {
    h.setAttribute('data-toc-id', 'ti' + i);
    var text = h.textContent.trim();
    var cls = 'toc-item' + (h.tagName === 'H4' ? ' sub' : '');
    html += '<div class="' + cls + '" onclick="scrollToHeading(\'ti' + i + '\')">' + escapeHtml(text) + '</div>';
  });
  container.innerHTML = html;
}

function scrollToHeading(id) {
  var slides = document.querySelectorAll('.section-slide');
  var slide = slides[currentSlideIdx];
  if (!slide) return;
  var el = slide.querySelector('[data-toc-id="' + id + '"]');
  if (!el) return;
  var slideRect = slide.getBoundingClientRect();
  var elRect = el.getBoundingClientRect();
  slide.scrollTo({ top: slide.scrollTop + (elRect.top - slideRect.top) - 20, behavior: 'smooth' });
  closeToc();
}

function toggleToc() {
  var panel = document.getElementById('tocPanel');
  var backdrop = document.getElementById('tocBackdrop');
  var btn = document.getElementById('tocBtn');
  if (!panel) return;
  if (panel.classList.contains('open')) {
    closeToc();
  } else {
    panel.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    if (btn) btn.classList.add('active');
  }
}

function closeToc() {
  var panel = document.getElementById('tocPanel');
  var backdrop = document.getElementById('tocBackdrop');
  var btn = document.getElementById('tocBtn');
  if (panel) panel.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  if (btn) btn.classList.remove('active');
}

document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowRight') { nextSlide(); e.preventDefault(); }
  if (e.key === 'ArrowLeft') { prevSlide(); e.preventDefault(); }
});

init();
