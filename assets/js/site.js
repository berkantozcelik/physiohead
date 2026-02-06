document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loaded');

  const drawCapsule = (ctx, x, y, length, radius, angle, colors, strokeColor) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const half = length / 2;
    const r = radius;

    const gradient = ctx.createLinearGradient(-half, 0, half, 0);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.5, colors[1]);
    gradient.addColorStop(1, colors[2]);

    ctx.beginPath();
    ctx.moveTo(-half + r, -r);
    ctx.lineTo(half - r, -r);
    ctx.arc(half - r, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-half + r, r);
    ctx.arc(-half + r, 0, r, Math.PI / 2, (Math.PI * 3) / 2);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  };

  const flower = document.querySelector('.flower');
  if (flower) {
    const petals = Array.from(flower.querySelectorAll('.flower-petal'));
    const lines = Array.from(flower.querySelectorAll('.flower-line'));
    const layoutFlower = () => {
      const rect = flower.getBoundingClientRect();
      if (window.matchMedia('(max-width: 1000px)').matches) return;
      if (petals.length === 0) return;

      const sample = petals[0].getBoundingClientRect();
      const nodeSize = Math.max(sample.width, sample.height);
      const radius = Math.max(
        210,
        Math.min(rect.width, rect.height) / 2 - nodeSize / 2 + 10
      );

      flower.style.setProperty('--radius', `${radius}px`);

      petals.forEach((petal, index) => {
        const angle = -90 + (360 / petals.length) * index;
        petal.style.setProperty('--angle', `${angle}deg`);
        if (lines[index]) {
          lines[index].style.setProperty('--angle', `${angle}deg`);
          lines[index].style.setProperty('--radius', `${radius}px`);
        }
      });
    };

    petals.forEach((petal, index) => {
      petal.addEventListener('mouseenter', () => {
        petals.forEach((node) => node.classList.remove('is-active'));
        lines.forEach((line) => line.classList.remove('is-active'));
        petal.classList.add('is-active');
        if (lines[index]) lines[index].classList.add('is-active');
      });
      petal.addEventListener('mouseleave', () => {
        petal.classList.remove('is-active');
        if (lines[index]) lines[index].classList.remove('is-active');
      });
    });

    layoutFlower();
    window.addEventListener('resize', layoutFlower);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(layoutFlower);
    }
  }

  const activityNetwork = document.querySelector('.activity-network');
  if (activityNetwork) {
    const canvas = activityNetwork.querySelector('.activity-network-canvas');
    const hub = activityNetwork.querySelector('.activity-hub-card');
    const nodes = Array.from(activityNetwork.querySelectorAll('.activity-node'));

    if (canvas && hub && nodes.length) {
      const ctx = canvas.getContext('2d');
      let activeIndex = null;
      let segments = [];

      const getRect = (el, baseRect) => {
        const rect = el.getBoundingClientRect();
        return {
          left: rect.left - baseRect.left,
          right: rect.right - baseRect.left,
          top: rect.top - baseRect.top,
          bottom: rect.bottom - baseRect.top,
          width: rect.width,
          height: rect.height,
        };
      };

      const getCenter = (rect) => ({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });

      const intersectRect = (from, to, rect) => {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const candidates = [];

        if (dx !== 0) {
          let t = (rect.left - from.x) / dx;
          let y = from.y + t * dy;
          if (t > 0 && y >= rect.top && y <= rect.bottom) {
            candidates.push({ t, x: rect.left, y });
          }
          t = (rect.right - from.x) / dx;
          y = from.y + t * dy;
          if (t > 0 && y >= rect.top && y <= rect.bottom) {
            candidates.push({ t, x: rect.right, y });
          }
        }

        if (dy !== 0) {
          let t = (rect.top - from.y) / dy;
          let x = from.x + t * dx;
          if (t > 0 && x >= rect.left && x <= rect.right) {
            candidates.push({ t, x, y: rect.top });
          }
          t = (rect.bottom - from.y) / dy;
          x = from.x + t * dx;
          if (t > 0 && x >= rect.left && x <= rect.right) {
            candidates.push({ t, x, y: rect.bottom });
          }
        }

        if (!candidates.length) return to;
        candidates.sort((a, b) => a.t - b.t);
        return { x: candidates[0].x, y: candidates[0].y };
      };

      const distanceToSegment = (p, a, b) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (dx === 0 && dy === 0) {
          return Math.hypot(p.x - a.x, p.y - a.y);
        }
        const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
        const clamped = Math.max(0, Math.min(1, t));
        const closest = { x: a.x + clamped * dx, y: a.y + clamped * dy };
        return Math.hypot(p.x - closest.x, p.y - closest.y);
      };

      const drawAxonLine = (start, end, isActive) => {
        const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
        gradient.addColorStop(0, isActive ? 'rgba(11, 61, 145, 0.65)' : 'rgba(11, 61, 145, 0.5)');
        gradient.addColorStop(0.5, isActive ? 'rgba(90, 140, 200, 0.45)' : 'rgba(90, 140, 200, 0.3)');
        gradient.addColorStop(1, isActive ? 'rgba(11, 61, 145, 0.65)' : 'rgba(11, 61, 145, 0.5)');

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = isActive ? 4.2 : 3.2;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = isActive ? 1.9 : 1.4;
        ctx.lineCap = 'round';
        ctx.stroke();
      };

      const drawMyelin = (start, end, isActive) => {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        if (!length) return;

        const angle = Math.atan2(dy, dx);
        const spacing = isActive ? 28 : 32;
        const offset = 18;
        const usable = Math.max(0, length - offset * 2);
        const count = Math.max(2, Math.floor(usable / spacing));
        const capsuleColors = [
          'rgba(255, 244, 196, 0.98)',
          'rgba(255, 252, 229, 1)',
          'rgba(242, 220, 150, 0.96)',
        ];
        const strokeColor = isActive ? 'rgba(11, 61, 145, 0.4)' : 'rgba(11, 61, 145, 0.3)';

        for (let i = 0; i < count; i += 1) {
          const t = (offset + i * spacing) / length;
          const x = start.x + dx * t;
          const y = start.y + dy * t;
          drawCapsule(ctx, x, y, 26, 6.2, angle, capsuleColors, strokeColor);
        }
      };

      const drawNetwork = () => {
        const rect = activityNetwork.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);

        if (rect.width < 860) return;

        const hubRect = getRect(hub, rect);
        const hubCenter = getCenter(hubRect);
        const nodeRects = nodes.map((node) => getRect(node, rect));
        const nodeCenters = nodeRects.map(getCenter);

        segments = nodeCenters.map((center, index) => {
          const end = intersectRect(center, hubCenter, nodeRects[index]);
          const start = intersectRect(hubCenter, center, hubRect);
          return { start, end };
        });

        segments.forEach((segment, index) => {
          const isActive = activeIndex === index;
          drawAxonLine(segment.start, segment.end, isActive);
          drawMyelin(segment.start, segment.end, isActive);
        });
      };

      drawNetwork();
      window.addEventListener('resize', drawNetwork);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(drawNetwork);
      }

      activityNetwork.addEventListener('mousemove', (event) => {
        const rect = activityNetwork.getBoundingClientRect();
        if (rect.width < 860) {
          if (activeIndex !== null) {
            activeIndex = null;
            nodes.forEach((node) => node.classList.remove('is-active'));
            drawNetwork();
          }
          return;
        }

        const pointer = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };

        let nearest = null;
        let nearestDistance = Infinity;
        segments.forEach((segment, index) => {
          const distance = distanceToSegment(pointer, segment.start, segment.end);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = index;
          }
        });

        const threshold = 10;
        const nextActive = nearestDistance <= threshold ? nearest : null;
        if (nextActive !== activeIndex) {
          activeIndex = nextActive;
          nodes.forEach((node, index) => {
            node.classList.toggle('is-active', index === activeIndex);
          });
          drawNetwork();
        }
      });

      activityNetwork.addEventListener('mouseleave', () => {
        activeIndex = null;
        nodes.forEach((node) => node.classList.remove('is-active'));
        drawNetwork();
      });

      nodes.forEach((node, index) => {
        node.addEventListener('mouseenter', () => {
          activeIndex = index;
          nodes.forEach((item, idx) => {
            item.classList.toggle('is-active', idx === activeIndex);
          });
          drawNetwork();
        });
        node.addEventListener('mouseleave', () => {
          activeIndex = null;
          nodes.forEach((item) => item.classList.remove('is-active'));
          drawNetwork();
        });
      });
    }
  }

  const activityFlow = document.querySelector('.activity-flow');
  if (activityFlow) {
    const canvas = activityFlow.querySelector('.activity-flow-canvas');
    const start = activityFlow.querySelector('.activity-hub-card');
    const end = activityFlow.querySelector('.impact-hub-card');
    const impactPanel = activityFlow.querySelector('.impact-panel');
    if (!canvas || !start || !end || !impactPanel) return;

    const ctx = canvas.getContext('2d');
    let flowActive = false;

    const getRect = (el, baseRect) => {
      const rect = el.getBoundingClientRect();
      return {
        left: rect.left - baseRect.left,
        right: rect.right - baseRect.left,
        top: rect.top - baseRect.top,
        bottom: rect.bottom - baseRect.top,
        width: rect.width,
        height: rect.height,
      };
    };

    const getCenter = (rect) => ({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });

    const intersectRect = (from, to, rect) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const candidates = [];

      if (dx !== 0) {
        let t = (rect.left - from.x) / dx;
        let y = from.y + t * dy;
        if (t > 0 && y >= rect.top && y <= rect.bottom) {
          candidates.push({ t, x: rect.left, y });
        }
        t = (rect.right - from.x) / dx;
        y = from.y + t * dy;
        if (t > 0 && y >= rect.top && y <= rect.bottom) {
          candidates.push({ t, x: rect.right, y });
        }
      }

      if (dy !== 0) {
        let t = (rect.top - from.y) / dy;
        let x = from.x + t * dx;
        if (t > 0 && x >= rect.left && x <= rect.right) {
          candidates.push({ t, x, y: rect.top });
        }
        t = (rect.bottom - from.y) / dy;
        x = from.x + t * dx;
        if (t > 0 && x >= rect.left && x <= rect.right) {
          candidates.push({ t, x, y: rect.bottom });
        }
      }

      if (!candidates.length) return to;
      candidates.sort((a, b) => a.t - b.t);
      return { x: candidates[0].x, y: candidates[0].y };
    };

    const getAnchor = (el, baseRect, position) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left - baseRect.left + rect.width / 2;
      const y = position === 'top'
        ? rect.top - baseRect.top - 6
        : rect.bottom - baseRect.top + 6;
      return { x, y };
    };

    const bezierPoint = (t, p0, p1, p2, p3) => {
      const cX = 3 * (p1.x - p0.x);
      const bX = 3 * (p2.x - p1.x) - cX;
      const aX = p3.x - p0.x - cX - bX;

      const cY = 3 * (p1.y - p0.y);
      const bY = 3 * (p2.y - p1.y) - cY;
      const aY = p3.y - p0.y - cY - bY;

      const x = aX * (t ** 3) + bX * (t ** 2) + cX * t + p0.x;
      const y = aY * (t ** 3) + bY * (t ** 2) + cY * t + p0.y;

      return { x, y };
    };

    const bezierTangent = (t, p0, p1, p2, p3) => {
      const cX = 3 * (p1.x - p0.x);
      const bX = 3 * (p2.x - p1.x) - cX;
      const aX = p3.x - p0.x - cX - bX;

      const cY = 3 * (p1.y - p0.y);
      const bY = 3 * (p2.y - p1.y) - cY;
      const aY = p3.y - p0.y - cY - bY;

      const dx = 3 * aX * (t ** 2) + 2 * bX * t + cX;
      const dy = 3 * aY * (t ** 2) + 2 * bY * t + cY;
      return { x: dx, y: dy };
    };

    const drawFlow = () => {
      const rect = activityFlow.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (rect.width < 860) return;

      const startRect = getRect(start, rect);
      const endRect = getRect(end, rect);
      const startCenter = getCenter(startRect);
      const endCenter = getCenter(endRect);
      const startPoint = intersectRect(startCenter, endCenter, startRect);
      const endPoint = intersectRect(endCenter, startCenter, endRect);
      const midY = (startPoint.y + endPoint.y) / 2;
      const offset = Math.min(110, rect.width * 0.12);
      const cp1 = { x: startPoint.x + offset, y: midY - 26 };
      const cp2 = { x: endPoint.x - offset, y: midY + 26 };

      const gradient = ctx.createLinearGradient(
        startPoint.x,
        startPoint.y,
        endPoint.x,
        endPoint.y
      );
      gradient.addColorStop(0, 'rgba(11, 61, 145, 0.55)');
      gradient.addColorStop(0.5, 'rgba(80, 130, 190, 0.35)');
      gradient.addColorStop(1, 'rgba(11, 61, 145, 0.55)');

      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, endPoint.x, endPoint.y);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = flowActive ? 5.6 : 4.8;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, endPoint.x, endPoint.y);
      ctx.strokeStyle = flowActive ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = flowActive ? 2.6 : 2.1;
      ctx.lineCap = 'round';
      ctx.stroke();

      const nodes = [0.2, 0.32, 0.44, 0.56, 0.68, 0.8];
      nodes.forEach((t) => {
        const point = bezierPoint(t, startPoint, cp1, cp2, endPoint);
        const tangent = bezierTangent(t, startPoint, cp1, cp2, endPoint);
        const angle = Math.atan2(tangent.y, tangent.x);
        drawCapsule(
          ctx,
          point.x,
          point.y,
          30,
          6.5,
          angle,
          ['rgba(255, 244, 196, 0.98)', 'rgba(255, 252, 229, 1)', 'rgba(242, 220, 150, 0.96)'],
          flowActive ? 'rgba(11, 61, 145, 0.5)' : 'rgba(11, 61, 145, 0.4)'
        );
      });

      const branchPoints = [0.35, 0.6];
      branchPoints.forEach((t, idx) => {
        const point = bezierPoint(t, startPoint, cp1, cp2, endPoint);
        const direction = idx % 2 === 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.quadraticCurveTo(
          point.x + direction * 26,
          point.y - 20,
          point.x + direction * 38,
          point.y - 10
        );
        ctx.strokeStyle = 'rgba(11, 61, 145, 0.32)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      });
    };

    const sampleBezier = (steps, p0, p1, p2, p3) => {
      const points = [];
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        points.push(bezierPoint(t, p0, p1, p2, p3));
      }
      return points;
    };

    const distanceToPolyline = (point, polyline) => {
      let min = Infinity;
      for (let i = 0; i < polyline.length - 1; i += 1) {
        const a = polyline[i];
        const b = polyline[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (dx === 0 && dy === 0) continue;
        const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy);
        const clamped = Math.max(0, Math.min(1, t));
        const closest = { x: a.x + clamped * dx, y: a.y + clamped * dy };
        const dist = Math.hypot(point.x - closest.x, point.y - closest.y);
        min = Math.min(min, dist);
      }
      return min;
    };

    const updateFlow = () => {
      drawFlow();
    };

    drawFlow();
    window.addEventListener('resize', updateFlow);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateFlow);
    }

    activityFlow.addEventListener('mousemove', (event) => {
      const rect = activityFlow.getBoundingClientRect();
      if (rect.width < 860) return;

      const startRect = getRect(start, rect);
      const endRect = getRect(end, rect);
      const startCenter = getCenter(startRect);
      const endCenter = getCenter(endRect);
      const startPoint = intersectRect(startCenter, endCenter, startRect);
      const endPoint = intersectRect(endCenter, startCenter, endRect);
      const midY = (startPoint.y + endPoint.y) / 2;
      const offset = Math.min(110, rect.width * 0.12);
      const cp1 = { x: startPoint.x + offset, y: midY - 26 };
      const cp2 = { x: endPoint.x - offset, y: midY + 26 };
      const polyline = sampleBezier(24, startPoint, cp1, cp2, endPoint);

      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      const distance = distanceToPolyline(pointer, polyline);
      const isNear = distance < 12;
      if (isNear !== flowActive) {
        flowActive = isNear;
        impactPanel.classList.toggle('is-active', flowActive);
        drawFlow();
      }
    });

    activityFlow.addEventListener('mouseleave', () => {
      flowActive = false;
      impactPanel.classList.remove('is-active');
      drawFlow();
    });
  }
});
