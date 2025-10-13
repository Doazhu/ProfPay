"Сделано с помишью Нейроной сети"
# Manual Navigation Testing Checklist

This document provides a comprehensive manual testing checklist for the sidebar navigation system.

## Test Environment Setup

1. Start the development server: `npm run dev`
2. Open the application in a web browser
3. Open browser developer tools to monitor console logs and network requests

## 1. Basic Route Navigation Tests

### Test 1.1: Home Page Navigation
- [ ] Click on "Главная" button in sidebar
- [ ] Verify URL changes to `/`
- [ ] Verify "Добро пожаловать в ProfPay" heading is displayed
- [ ] Verify home button is highlighted (active state)

### Test 1.2: Payers Page Navigation
- [ ] Click on "Плательщики" button in sidebar
- [ ] Verify URL changes to `/payers`
- [ ] Verify "Управление плательщиками" heading is displayed
- [ ] Verify payers button is highlighted (active state)

### Test 1.3: Reports Page Navigation
- [ ] Click on "Отчёты" button in sidebar
- [ ] Verify URL changes to `/reports`
- [ ] Verify "Отчёты" heading is displayed
- [ ] Verify reports button is highlighted (active state)
- [ ] Verify "Раздел в разработке" placeholder content is shown

### Test 1.4: Notifications Page Navigation
- [ ] Click on "Уведомления" button in sidebar
- [ ] Verify URL changes to `/notifications`
- [ ] Verify "Уведомления" heading is displayed
- [ ] Verify notifications button is highlighted (active state)
- [ ] Verify "Раздел в разработке" placeholder content is shown

### Test 1.5: Settings Page Navigation
- [ ] Click on "Настройки" button in sidebar
- [ ] Verify URL changes to `/settings`
- [ ] Verify "Настройки" heading is displayed
- [ ] Verify settings button is highlighted (active state)
- [ ] Verify "Раздел в разработке" placeholder content is shown

## 2. Active State Visual Indication Tests

### Test 2.1: Active State Highlighting
- [ ] Navigate to each page and verify the corresponding sidebar button has:
  - [ ] `bg-white bg-opacity-20` classes
  - [ ] `border-r-2 border-accent-solid` classes
  - [ ] Other buttons do NOT have these classes

### Test 2.2: Active State Persistence
- [ ] Navigate to a page
- [ ] Refresh the browser
- [ ] Verify the correct button remains highlighted

### Test 2.3: Current Page Button Behavior
- [ ] Navigate to any page
- [ ] Try clicking the same page button again
- [ ] Verify the button is disabled (`cursor-default` class)
- [ ] Verify no navigation occurs

## 3. Browser Back/Forward Button Tests

### Test 3.1: Browser Back Button
- [ ] Navigate: Home → Payers → Reports
- [ ] Click browser back button
- [ ] Verify navigation goes to Payers page
- [ ] Verify URL is `/payers`
- [ ] Verify payers button is highlighted
- [ ] Click browser back button again
- [ ] Verify navigation goes to Home page
- [ ] Verify URL is `/`
- [ ] Verify home button is highlighted

### Test 3.2: Browser Forward Button
- [ ] After completing Test 3.1, click browser forward button
- [ ] Verify navigation goes to Payers page
- [ ] Click browser forward button again
- [ ] Verify navigation goes to Reports page
- [ ] Verify correct active states

### Test 3.3: Direct URL Access
- [ ] Manually type `/reports` in address bar
- [ ] Verify reports page loads correctly
- [ ] Verify reports button is highlighted
- [ ] Repeat for all routes: `/`, `/payers`, `/notifications`, `/settings`

## 4. Sidebar Collapsed/Expanded State Tests

### Test 4.1: Sidebar Collapse Functionality
- [ ] Click the collapse button (←)
- [ ] Verify sidebar width changes to narrow (w-16)
- [ ] Verify button text changes to (☰)
- [ ] Verify menu labels are hidden
- [ ] Verify only icons are visible

### Test 4.2: Navigation in Collapsed State
- [ ] With sidebar collapsed, click each menu icon
- [ ] Verify navigation works correctly
- [ ] Verify active state highlighting still works
- [ ] Verify URL updates correctly

### Test 4.3: Tooltip Display in Collapsed State
- [ ] With sidebar collapsed, hover over each menu icon
- [ ] Verify tooltip appears with menu label
- [ ] Verify tooltip shows current page indicator (•) for active item
- [ ] Verify tooltip disappears when not hovering

### Test 4.4: Sidebar Expand Functionality
- [ ] With sidebar collapsed, click the expand button (☰)
- [ ] Verify sidebar width changes to full (w-64)
- [ ] Verify button text changes to (←)
- [ ] Verify menu labels are visible again
- [ ] Verify active state is maintained

## 5. Error Handling and 404 Page Tests

### Test 5.1: Invalid Route Handling
- [ ] Navigate to an invalid URL (e.g., `/invalid-route`)
- [ ] Verify 404 page is displayed
- [ ] Verify "404" and "Страница не найдена" text is shown
- [ ] Verify sidebar is still functional

### Test 5.2: 404 Page Navigation
- [ ] From 404 page, click "Перейти на главную" button
- [ ] Verify navigation to home page works
- [ ] From 404 page, click "Вернуться назад" button
- [ ] Verify browser back functionality works

### Test 5.3: Error Boundary Testing
- [ ] Check browser console for any JavaScript errors
- [ ] Verify error boundary displays if any component fails
- [ ] Verify navigation continues to work after errors

## 6. Navigation Throttling and Performance Tests

### Test 6.1: Rapid Click Prevention
- [ ] Rapidly click the same navigation button multiple times
- [ ] Verify only one navigation occurs
- [ ] Check console for "Navigation throttled" messages
- [ ] Verify no performance issues or UI freezing

### Test 6.2: Quick Navigation Between Pages
- [ ] Quickly navigate between different pages
- [ ] Verify all navigations complete successfully
- [ ] Verify no race conditions or incorrect active states
- [ ] Verify smooth transitions

## 7. Page Transitions and Loading States Tests

### Test 7.1: Loading Indicators
- [ ] Navigate between pages and observe loading indicators
- [ ] Verify "Переключение раздела..." message appears briefly
- [ ] Verify loading spinner is displayed
- [ ] Verify loading state clears after navigation

### Test 7.2: Transition Animations
- [ ] Navigate between pages and observe animations
- [ ] Verify smooth fade/slide transitions
- [ ] Verify transitions complete within 300ms
- [ ] Verify no jarring or broken animations

## 8. Quick Actions Navigation Tests

### Test 8.1: Home Page Quick Actions
- [ ] From home page, click "Управление плательщиками" quick action
- [ ] Verify navigation to payers page
- [ ] Return to home, click "Отчёты" quick action
- [ ] Verify navigation to reports page
- [ ] Return to home, click "Уведомления" quick action
- [ ] Verify navigation to notifications page
- [ ] Return to home, click "Настройки" quick action
- [ ] Verify navigation to settings page

### Test 8.2: Quick Actions Active State
- [ ] After using quick actions, verify correct sidebar button is highlighted
- [ ] Verify URL is updated correctly
- [ ] Verify page content matches navigation

## 9. Cross-Browser Compatibility Tests

### Test 9.1: Chrome/Chromium
- [ ] Run all above tests in Chrome
- [ ] Note any issues or differences

### Test 9.2: Firefox
- [ ] Run all above tests in Firefox
- [ ] Note any issues or differences

### Test 9.3: Safari (if available)
- [ ] Run all above tests in Safari
- [ ] Note any issues or differences

## 10. Mobile/Responsive Tests

### Test 10.1: Mobile View Navigation
- [ ] Test on mobile device or use browser dev tools mobile view
- [ ] Verify sidebar functionality on small screens
- [ ] Verify touch navigation works correctly
- [ ] Verify responsive design maintains usability

## Test Results Summary

### Passed Tests: ___/___
### Failed Tests: ___/___

### Issues Found:
1. 
2. 
3. 

### Notes:
- 
- 
- 

### Overall Assessment:
[ ] All navigation functionality works as expected
[ ] Minor issues found but navigation is functional
[ ] Major issues found that need immediate attention

---

**Test Completed By:** _______________
**Date:** _______________
**Browser/Version:** _______________
**OS:** _______________