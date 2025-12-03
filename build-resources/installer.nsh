; Wormhole Desktop NSIS Installer Customizations
; ============================================
; Clean install/upgrade without popup

!macro preInit
!macroend

!macro customInit
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Setup - ${PRODUCT_NAME}"
  !define MUI_WELCOMEPAGE_TEXT "This will install ${PRODUCT_NAME} ${VERSION} on your computer.$\r$\n$\r$\nIf a previous version is installed, it will be upgraded automatically. Your settings will be preserved.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInstall
!macroend

!macro customUnInstall
!macroend
